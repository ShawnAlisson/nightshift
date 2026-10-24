import { streamChat } from "@/lib/ai";
import type { AssistantEvent } from "@/lib/assistant-events";
import { runComputerAgent } from "@/lib/computer/agent";
import { isComputerUseEnabled } from "@/lib/computer/config";
import { assistantErrorMessage } from "@/lib/assistant-errors";
import { getRoutineContext } from "@/lib/routines";
import { Conversation } from "@/lib/models/conversation";
import { connectDB } from "@/lib/mongodb";
import { getSessionUserId } from "@/lib/session";
import { chatSchema, MAX_MESSAGES } from "@/lib/validations/assistant";

const TITLE_LENGTH = 60;

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = chatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { conversationId, content } = parsed.data;

  await connectDB();

  // History is loaded server-side; the client only ever sends the new message.
  // The length guard leaves room for this user message plus the assistant reply.
  const userMessage = { role: "user" as const, content };
  const isNew = !conversationId;
  const conversation = isNew
    ? await Conversation.create({
        userId,
        title: content.slice(0, TITLE_LENGTH),
        messages: [userMessage],
      })
    : await Conversation.findOneAndUpdate(
        { _id: conversationId, userId, [`messages.${MAX_MESSAGES - 2}`]: { $exists: false } },
        { $push: { messages: userMessage } },
        { returnDocument: "after" },
      );

  if (!conversation) {
    return Response.json({ error: "Conversation not found or full" }, { status: 404 });
  }

  const history = conversation.messages.map(({ role, content }) => ({ role, content }));
  const filter = { _id: conversation._id, userId };

  // Drops the unanswered user message (or the whole new chat) so roles keep alternating.
  const rollback = () =>
    isNew
      ? Conversation.deleteOne(filter)
      : Conversation.updateOne(filter, { $pop: { messages: 1 } });

  // Await the first chunk so a provider failure becomes a clean error response.
  // The user's saved routines let "the usual" mean what this person means by it.
  const routineContext = await getRoutineContext(userId);
  const events: AsyncGenerator<AssistantEvent> = isComputerUseEnabled()
    ? runComputerAgent(history, userId, request.signal, routineContext)
    : streamChat(history, request.signal, routineContext);
  let first: IteratorResult<AssistantEvent>;
  try {
    first = await events.next();
  } catch (error) {
    if (!request.signal.aborted) console.error("assistant stream failed", error);
    await rollback();
    return Response.json({ error: assistantErrorMessage(error) }, { status: 502 });
  }

  const encoder = new TextEncoder();
  let reply = "";
  let cancelled = false;

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let failure: unknown;
      try {
        for (let result = first; !result.done; result = await events.next()) {
          if (result.value.type === "text") reply += result.value.text;
          // One JSON event per line.
          if (!cancelled) controller.enqueue(encoder.encode(`${JSON.stringify(result.value)}\n`));
        }
      } catch (error) {
        failure = error;
        if (!request.signal.aborted) console.error("assistant stream failed", error);
      }

      try {
        // A partial reply is kept if the stream failed or the client stopped it.
        if (reply) {
          await Conversation.updateOne(filter, {
            $push: { messages: { role: "assistant", content: reply } },
          });
        } else {
          await rollback();
        }
      } catch (error) {
        console.error("assistant persist failed", error);
        failure ??= error;
      }

      if (cancelled) return;
      // The response has already started, so a failure travels as an event rather than a broken stream.
      if (failure) controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", message: assistantErrorMessage(failure) })}\n`));
      // Persisted before closing, so a finished stream means the chat is saved.
      controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Conversation-Id": conversation.id,
    },
  });
}
