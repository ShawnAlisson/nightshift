/**
 * One-time setup: builds the desktop image in a Vercel Sandbox and saves it as a
 * snapshot. Every user desktop starts from this snapshot. The desktop is
 * Openbox with a bottom panel, Chrome, a file manager and a terminal, themed to
 * match the app (see scripts/desktop).
 *
 *   npm run desktop:snapshot
 *
 * Needs Vercel access (`vercel link && vercel env pull`, or VERCEL_TOKEN +
 * VERCEL_TEAM_ID + VERCEL_PROJECT_ID). Prints SANDBOX_SNAPSHOT_ID for .env.local.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Sandbox } from "@vercel/sandbox";

const BUILD_TIMEOUT_MS = 20 * 60_000;
const DESKTOP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "desktop");
const UPLOAD_DIR = "/tmp/desktop";
const SCRIPTS = new Set(["start-desktop.sh", "lumo-chrome", "build-desktop.sh", "make-wallpaper.py"]);
const APT = "DEBIAN_FRONTEND=noninteractive apt-get";

// The desktop cannot work without these.
const REQUIRED = [
  "tigervnc-standalone-server", "tigervnc-tools", "novnc", "websockify", "openbox", "tint2",
  "pcmanfm", "lxterminal", "feh", "xdotool", "imagemagick", "x11-utils", "x11-xserver-utils",
  "dbus-x11", "shared-mime-info", "adwaita-icon-theme", "xdg-utils", "libxml2-utils",
  "ca-certificates", "curl", "fonts-liberation", "fonts-dejavu-core",
];
// Only polish. Each is tried on its own, so one missing on this release is skipped.
const OPTIONAL = ["papirus-icon-theme", "fonts-inter", "fonts-jetbrains-mono", "fonts-noto-color-emoji"];

const { VERCEL_TOKEN: token, VERCEL_TEAM_ID: teamId, VERCEL_PROJECT_ID: projectId } = process.env;
const credentials = token && teamId && projectId ? { token, teamId, projectId } : {};

const sandbox = await Sandbox.create({ ...credentials, timeout: BUILD_TIMEOUT_MS });

async function step(title: string, script: string) {
  console.log(`\n→ ${title}`);
  const result = await sandbox.runCommand({ cmd: "bash", args: ["-c", script], sudo: true });
  if (result.exitCode !== 0) {
    console.error(await result.stdout());
    console.error(await result.stderr());
    throw new Error(`Step failed: ${title}`);
  }
  console.log((await result.stdout()).trim().split("\n").slice(-3).join("\n") || "  done");
}

/** Every file under scripts/desktop, keyed by its path relative to that folder. */
async function desktopFiles() {
  const entries = await readdir(DESKTOP_DIR, { recursive: true, withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const relative = path.relative(DESKTOP_DIR, path.join(entry.parentPath, entry.name));
        return {
          path: `${UPLOAD_DIR}/${relative}`,
          content: await readFile(path.join(DESKTOP_DIR, relative)),
          mode: SCRIPTS.has(relative) ? 0o755 : 0o644,
        };
      }),
  );
}

try {
  const os = await (await sandbox.runCommand("cat", ["/etc/os-release"])).stdout();
  console.log(os.split("\n").slice(0, 2).join("\n"));
  if (!/ubuntu|debian/i.test(os)) {
    throw new Error("This script installs with apt and expects an Ubuntu or Debian image");
  }

  await step("Installing the desktop", `${APT} update && ${APT} install -y --no-install-recommends ${REQUIRED.join(" ")}`);
  await step(
    "Installing theme extras",
    `for p in ${OPTIONAL.join(" ")}; do ${APT} install -y --no-install-recommends $p >/dev/null 2>&1 && echo "installed $p" || echo "skipped $p (not available)"; done`,
  );
  await step(
    "Installing Google Chrome",
    `curl -fsSL -o /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && ${APT} install -y /tmp/chrome.deb && rm /tmp/chrome.deb`,
  );

  const files = await desktopFiles();
  const folders = [...new Set(files.map((file) => path.dirname(file.path)))];
  await sandbox.runCommand({ cmd: "mkdir", args: ["-p", ...folders] });
  await sandbox.writeFiles(files);
  console.log(`\nUploaded ${files.length} desktop files`);
  await step("Building the desktop", `bash ${UPLOAD_DIR}/build-desktop.sh`);

  // Snapshotting also shuts the sandbox down.
  const snapshot = await sandbox.snapshot({ expiration: 0 });
  console.log(`\nSnapshot created. Add this to .env.local:\n\nSANDBOX_SNAPSHOT_ID=${snapshot.snapshotId}\n`);
} catch (error) {
  await sandbox.stop().catch(() => undefined);
  throw error;
}
