import { ASSISTANT_MODEL, getMubitClient } from "@/lib/mubit";
import { getSessionUserId } from "@/lib/session";
import { chatSchema } from "@/lib/validations/assistant";

const SYSTEM_PROMPT =
  "You are a helpful, concise personal assistant. Answer clearly and ask a short clarifying question when a request is ambiguous.";

export async function POST(request: Request) {
  if (!(await getSessionUserId())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const stream = getMubitClient().messages.stream(
    {
      model: ASSISTANT_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: parsed.data.messages,
    },
    { signal: request.signal },
  );

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (error) {
        // Don't leak upstream details to the client.
        console.error("assistant stream failed", error);
        controller.error(error);
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
