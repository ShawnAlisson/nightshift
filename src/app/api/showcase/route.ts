import { z } from "zod";
import { isComputerUseEnabled } from "@/lib/computer/config";
import { ensureDesktop } from "@/lib/computer/desktop";
import { getSessionUserId } from "@/lib/session";
import { runLiveStep } from "@/lib/showcase/live";
import { LIVE_STEPS } from "@/lib/showcase/live-steps";

// Only a step's name is accepted, never coordinates or text, so this can't be used to drive the desktop freely.
const bodySchema = z.object({ step: z.enum(LIVE_STEPS) });

/** Runs one named step of the live walkthrough on the signed-in user's own desktop. */
export async function POST(request: Request) {
  if (!isComputerUseEnabled()) return Response.json({ error: "Not available" }, { status: 404 });
  const userId = await getSessionUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  try {
    await runLiveStep(await ensureDesktop(userId), parsed.data.step);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("live step failed", parsed.data.step, error);
    return Response.json({ error: "That step didn't work" }, { status: 502 });
  }
}
