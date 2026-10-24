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
// Nothing on the desktop should ever wait forever: a stuck command would stall the whole reply.
const ACTION_TIMEOUT_MS = 20_000;
const TYPING_TIMEOUT_MS = 90_000; // typing long text is slow on purpose
const PROBE_TIMEOUT_MS = 10_000;

/**
 * Chrome flags that keep warnings off the page. Without them a fresh Chrome shows a bar about
 * --no-sandbox (pushing the page down about 60px, so clicks miss) and, after we close it, a
 * "restore pages?" bubble.
 */
export const QUIET_CHROME_FLAGS = ["--test-type", "--disable-session-crashed-bubble", "--hide-crash-restore-bubble"];
const CLEAR_PROFILE_LOCKS = 'rm -f "$HOME"/chrome-profile/SingletonLock "$HOME"/chrome-profile/SingletonSocket "$HOME"/chrome-profile/SingletonCookie';

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

  /** Runs a desktop command with a time limit, turning a hang or failure into an ActionError. */
  private async run(params: { cmd: string; args: string[]; timeoutMs: number }) {
    try {
      return await this.sandbox.runCommand({ ...params, env: ENV });
    } catch (error) {
      console.error("desktop command failed", error);
      throw new ActionError("The desktop didn't respond in time");
    }
  }

  private async xdotool(args: string[]) {
    const timeoutMs = args[0] === "type" ? TYPING_TIMEOUT_MS : ACTION_TIMEOUT_MS;
    const result = await this.run({ cmd: "xdotool", args, timeoutMs });
    if (result.exitCode !== 0) {
      throw new ActionError(`xdotool failed: ${(await result.stderr()).trim().slice(0, 300)}`);
    }
    return result;
  }

  /**
   * Closes Chrome and starts it again, optionally with extra arguments such as a page to open.
   * Clears Chrome's stale profile lock first, or Chrome stops at a dialog instead of opening.
   */
  async restartBrowser(args: string[] = ["about:blank"]) {
    // Match the process name exactly. `pkill -f` matches whole command lines, including this very
    // command's own, so it killed the shell before the lock files could be removed.
    await this.run({
      cmd: "bash",
      // xmessage is the program Chrome uses to show its "profile in use" warning. It outlives Chrome,
      // so earlier failed launches would otherwise leave their warnings sitting on the desktop.
      args: ["-c", "pkill -x xmessage || true; pkill -x chrome || true; for i in $(seq 1 25); do pgrep -x chrome >/dev/null || break; sleep 0.2; done"],
      timeoutMs: ACTION_TIMEOUT_MS,
    });
    await this.run({ cmd: "bash", args: ["-c", CLEAR_PROFILE_LOCKS], timeoutMs: PROBE_TIMEOUT_MS });
    await this.sandbox.runCommand({ cmd: "lumo-chrome", args, detached: true, env: ENV });
  }

  /** Starts a clean browser and confirms a real page window opened (not a startup dialog). */
  async ensureBrowser() {
    await this.restartBrowser([...QUIET_CHROME_FLAGS, "about:blank"]);
    if (!(await this.waitForTitle("about:blank", 25_000))) throw new ActionError("The browser didn't start");
  }

  /** The title of the window in front, which for Chrome is the page title. */
  async windowTitle() {
    const result = await this.run({ cmd: "xdotool", args: ["getactivewindow", "getwindowname"], timeoutMs: PROBE_TIMEOUT_MS });
    return result.exitCode === 0 ? (await result.stdout()).trim() : "";
  }

  /** Waits for the page title to become something other than `from`. */
  async waitForTitleChange(from: string, maxMs: number) {
    for (const end = Date.now() + maxMs; Date.now() < end; await sleep(700)) {
      const title = await this.windowTitle();
      if (title && title !== from) return true;
    }
    return false;
  }

  async waitForTitle(part: string, maxMs: number) {
    for (const end = Date.now() + maxMs; Date.now() < end; await sleep(700)) {
      if ((await this.windowTitle()).includes(part)) return true;
    }
    return false;
  }

  /**
   * Waits until the screen stops changing, which is when a page has finished loading (loading
   * placeholders shimmer, so they keep it "changing"). Gives up after `maxMs` and carries on.
   */
  async settle(maxMs: number, stillPolls = 2) {
    let last = "";
    let still = 0;
    for (const end = Date.now() + maxMs; Date.now() < end; await sleep(700)) {
      const result = await this.run({
        cmd: "bash",
        // A small, coarse copy of the screen: enough to notice a page changing, too little to notice noise.
        args: ["-c", "import -window root -silent -resize 96x60! -depth 5 gray:- | md5sum | cut -c1-12"],
        timeoutMs: ACTION_TIMEOUT_MS,
      });
      const fingerprint = (await result.stdout()).trim();
      still = fingerprint && fingerprint === last ? still + 1 : 0;
      last = fingerprint;
      if (still >= stillPolls) return true;
    }
    return false;
  }

  /**
   * How colourful the screen is, from 0 (greyscale) to 1. Loading placeholders are grey and real
   * content is not, so this tells "still loading" from "loaded" where the screen shimmers.
   */
  async colourfulness() {
    const result = await this.run({
      cmd: "bash",
      args: [
        "-c",
        "import -window root -silent -resize 128x80! png:- | convert png:- -colorspace HSL -channel G -separate -format '%[fx:mean]' info:",
      ],
      timeoutMs: ACTION_TIMEOUT_MS,
    });
    return Number((await result.stdout()).trim()) || 0;
  }

  async waitForColour(atLeast: number, maxMs: number) {
    for (const end = Date.now() + maxMs; Date.now() < end; await sleep(1000)) {
      if ((await this.colourfulness()) >= atLeast) return true;
    }
    return false;
  }

  /** Glides the pointer to a point the way a hand would, then clicks. Coordinates must be on screen. */
  async clickSmoothly(x: number, y: number) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= SCREEN.width || y >= SCREEN.height) {
      throw new ActionError("That point is off the screen");
    }
    const located = await this.xdotool(["getmouselocation", "--shell"]);
    const output = await located.stdout();
    const fromX = Number(/X=(\d+)/.exec(output)?.[1] ?? x);
    const fromY = Number(/Y=(\d+)/.exec(output)?.[1] ?? y);

    // An ease-in-out path: slow at the start and end, quicker in the middle.
    const STEPS = 16;
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    const moves = Array.from({ length: STEPS }, (_, i) => {
      const t = ease((i + 1) / STEPS);
      return ["mousemove", String(Math.round(fromX + (x - fromX) * t)), String(Math.round(fromY + (y - fromY) * t)), "sleep", "0.022"];
    });
    await this.xdotool([...moves.flat(), "sleep", "0.15", "click", "1"]);
  }

  async screenshot() {
    const result = await this.run({
      cmd: "bash",
      args: ["-c", "import -window root -silent png:- | base64 -w0"],
      timeoutMs: ACTION_TIMEOUT_MS,
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
  const probe = await sandbox.runCommand({
    cmd: "xdotool",
    args: ["getmouselocation"],
    env: ENV,
    timeoutMs: PROBE_TIMEOUT_MS,
  });
  return probe.exitCode === 0;
}

/** Whether the noVNC viewer accepts connections. It starts a few seconds after the screen does. */
async function isViewerUp(sandbox: Sandbox) {
  const probe = await sandbox.runCommand({
    cmd: "bash",
    args: ["-c", `exec 3<>/dev/tcp/127.0.0.1/${NOVNC_PORT}`],
    timeoutMs: PROBE_TIMEOUT_MS,
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
    // A restarted sandbox is a new machine, but Chrome's profile still says another computer is
    // using it, and Chrome stops to ask. Nothing is running yet, so the leftover locks are stale.
    await sandbox.runCommand({ cmd: "bash", args: ["-c", CLEAR_PROFILE_LOCKS], timeoutMs: PROBE_TIMEOUT_MS });
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
