import { isComputerUseEnabled } from "@/lib/computer/config";
import { ensureDesktop, stopDesktop } from "@/lib/computer/desktop";
import { getSessionUserId } from "@/lib/session";

async function authorize() {
  if (!isComputerUseEnabled()) {
    return { error: Response.json({ error: "Computer use is not enabled" }, { status: 404 }) };
  }
  const userId = await getSessionUserId();
  if (!userId) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId };
}

/** Starts (or resumes) the signed-in user's desktop and returns its live view URL. */
export async function POST() {
  const { userId, error } = await authorize();
  if (error) return error;

  try {
    const desktop = await ensureDesktop(userId);
    return Response.json({ url: desktop.viewUrl });
  } catch (err) {
    console.error("desktop start failed", err);
    return Response.json({ error: "The desktop couldn't be started" }, { status: 502 });
  }
}

/** Stops the desktop to save cost. Its disk, and so its logins, is kept. */
export async function DELETE() {
  const { userId, error } = await authorize();
  if (error) return error;

  await stopDesktop(userId);
  return Response.json({ ok: true });
}
