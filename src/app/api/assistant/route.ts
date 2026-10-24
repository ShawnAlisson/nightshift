import { streamChat } from "@/lib/ai";
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
  const { conversationId, provider, content } = parsed.data;

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
  const chunks = streamChat(provider, history, request.signal);
  let first: IteratorResult<string>;
  try {
    first = await chunks.next();
  } catch (error) {
    if (!request.signal.aborted) console.error("assistant stream failed", error);
    await rollback();
    return Response.json({ error: "The assistant couldn't respond. Please try again." }, { status: 502 });
  }

  const encoder = new TextEncoder();
  let reply = "";
  let cancelled = false;

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let failure: unknown;
      try {
        for (let result = first; !result.done; result = await chunks.next()) {
          reply += result.value;
          if (!cancelled) controller.enqueue(encoder.encode(result.value));
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
      // Persisted before closing, so a finished stream means the chat is saved.
      if (failure) controller.error(failure);
      else controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Conversation-Id": conversation.id,
    },
  });
}
