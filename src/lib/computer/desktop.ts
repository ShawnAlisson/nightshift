import "server-only";
import { createHmac } from "node:crypto";
import { Sandbox } from "@vercel/sandbox";
import { ActionError, planAction, SCREEN, type ComputerAction } from "@/lib/computer/actions";

const DISPLAY = ":99";
const NOVNC_PORT = 6080;
const START_SCRIPT = "/usr/local/bin/start-desktop.sh";
const SESSION_TIMEOUT_MS = 15 * 60_000;
const READY_ATTEMPTS = 30;
const ENV = { DISPLAY };

/** Uses an access token when configured; otherwise the SDK falls back to the OIDC token. */
function credentials() {
  const { VERCEL_TOKEN: token, VERCEL_TEAM_ID: teamId, VERCEL_PROJECT_ID: projectId } = process.env;
  return token && teamId && projectId ? { token, teamId, projectId } : {};
}

function snapshotId() {
  const id = process.env.SANDBOX_SNAPSHOT_ID;
  if (!id) {
    throw new Error("SANDBOX_SNAPSHOT_ID is not set. Run `npm run desktop:snapshot` and add the ID to .env.local");
  }
  return id;
}

// One persistent desktop per user: browser logins and files survive between sessions.
const sandboxName = (userId: string) => `desktop-${userId}`;

/** Deterministic, so a resumed desktop needs no stored secret. VNC only reads the first 8 characters. */
function vncPassword(userId: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret)
    .update(`vnc:${userId}`)
    .digest("base64")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 8);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Base64 PNG for screenshots, otherwise a short text result. */
export type PerformResult = { image: string } | { text: string };

export class Desktop {
  constructor(
    private readonly sandbox: Sandbox,
    readonly viewUrl: string,
  ) {}

  private async xdotool(args: string[]) {
    const result = await this.sandbox.runCommand({ cmd: "xdotool", args, env: ENV });
    if (result.exitCode !== 0) {
      throw new ActionError(`xdotool failed: ${(await result.stderr()).trim().slice(0, 300)}`);
    }
    return result;
  }

  async screenshot() {
    const result = await this.sandbox.runCommand({
      cmd: "bash",
      args: ["-c", "import -window root -silent png:- | base64 -w0"],
      env: ENV,
    });
    const data = (await result.stdout()).trim();
    if (result.exitCode !== 0 || !data) throw new ActionError("Could not capture the screen");
    return data;
  }

  /**
   * Runs one action. Returns a base64 PNG for screenshots, otherwise a short text result.
   * Throws ActionError for invalid or failed actions.
   */
  async perform(action: ComputerAction): Promise<PerformResult> {
    const plan = planAction(action);

    if (plan.kind === "screenshot") return { image: await this.screenshot() };
    if (plan.kind === "cursor_position") {
      const result = await this.xdotool(["getmouselocation", "--shell"]);
      const output = await result.stdout();
      return { text: `[${/X=(\d+)/.exec(output)?.[1]}, ${/Y=(\d+)/.exec(output)?.[1]}]` };
    }

    for (const step of plan.steps) {
      if ("sleepMs" in step) await sleep(step.sleepMs);
      else await this.xdotool(step.xdotool);
    }
    return { text: "OK" };
  }
}

async function isDesktopUp(sandbox: Sandbox) {
  const probe = await sandbox.runCommand({ cmd: "xdotool", args: ["getmouselocation"], env: ENV });
  return probe.exitCode === 0;
}

/** Whether the noVNC viewer accepts connections. It starts a few seconds after the screen does. */
async function isViewerUp(sandbox: Sandbox) {
  const probe = await sandbox.runCommand({
    cmd: "bash",
    args: ["-c", `exec 3<>/dev/tcp/127.0.0.1/${NOVNC_PORT}`],
  });
  return probe.exitCode === 0;
}

/** Gets (or creates and starts) the user's desktop. Safe to call repeatedly. */
export async function ensureDesktop(userId: string): Promise<Desktop> {
  const password = vncPassword(userId);
  const sandbox = await Sandbox.getOrCreate({
    ...credentials(),
    name: sandboxName(userId),
    source: { type: "snapshot", snapshotId: snapshotId() },
    ports: [NOVNC_PORT],
    timeout: SESSION_TIMEOUT_MS,
    resources: { vcpus: 2 },
    tags: { purpose: "assistant-desktop" },
  });

  // Keep an active session alive; this may be refused at the plan's maximum, which is fine.
  await sandbox.extendTimeout(SESSION_TIMEOUT_MS).catch(() => undefined);

  if (!(await isDesktopUp(sandbox))) {
    await sandbox.runCommand({
      cmd: START_SCRIPT,
      detached: true,
      env: { VNC_PASSWORD: password, RESOLUTION: `${SCREEN.width}x${SCREEN.height}` },
    });
  } else if (!(await isViewerUp(sandbox))) {
    // The screen is running but the viewer is not (it may have crashed): start just the viewer.
    await sandbox.runCommand({
      cmd: "websockify",
      args: ["--web", "/usr/share/novnc", String(NOVNC_PORT), "localhost:5900"],
      detached: true,
    });
  }

  // The URL is only useful once the viewer answers; an iframe never retries a 502.
  for (let attempt = 0; ; attempt++) {
    if ((await isDesktopUp(sandbox)) && (await isViewerUp(sandbox))) break;
    if (attempt >= READY_ATTEMPTS) throw new Error("The desktop did not start in time");
    await sleep(1000);
  }

  const viewUrl = `${sandbox.domain(NOVNC_PORT)}/vnc.html?autoconnect=true&resize=scale&password=${password}`;
  return new Desktop(sandbox, viewUrl);
}

/** Stops the user's desktop to save cost. The disk is kept, so logins survive. */
export async function stopDesktop(userId: string) {
  try {
    const sandbox = await Sandbox.get({ ...credentials(), name: sandboxName(userId) });
    await sandbox.stop();
  } catch {
    // No desktop exists, or it is already stopped.
  }
}

/** Starts the user's desktop the first time it is needed, so chat-only messages never pay for one. */
export class DesktopLease {
  private desktop?: Desktop;

  constructor(private readonly userId: string) {}

  async acquire(): Promise<{ desktop: Desktop; created: boolean }> {
    if (this.desktop) return { desktop: this.desktop, created: false };
    this.desktop = await ensureDesktop(this.userId);
    return { desktop: this.desktop, created: true };
  }
}
