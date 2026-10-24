"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MAX_MESSAGE_LENGTH,
  PROVIDER_LABELS,
  PROVIDERS,
  type ChatMessage,
  type Provider,
} from "@/lib/validations/assistant";

type ChatProps = {
  conversationId?: string;
  initialMessages?: ChatMessage[];
};

const GENERIC_ERROR = "The assistant couldn't respond. Please try again.";

export function Chat({ conversationId, initialMessages = [] }: ChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const bottomRef = useRef<HTMLDivElement>(null);

  function appendToLast(text: string) {
    setMessages((current) => {
      const last = current[current.length - 1];
      return [...current.slice(0, -1), { ...last, content: last.content + text }];
    });
    bottomRef.current?.scrollIntoView({ block: "end" });
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const content = input.trim();
    if (!content || pending) return;

    setMessages((current) => [
      ...current,
      { role: "user", content },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setError(undefined);
    setPending(true);

    let id = conversationId;
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, provider, content }),
      });
      if (!response.ok || !response.body) {
        const { error } = await response.json().catch(() => ({}));
        throw new Error(typeof error === "string" ? error : GENERIC_ERROR);
      }
      id = response.headers.get("X-Conversation-Id") ?? id;

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        appendToLast(value);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : GENERIC_ERROR);
      // The server rolls back an unanswered message, so mirror that here.
      setMessages((current) =>
        current.at(-1)?.content === "" ? current.slice(0, -2) : current,
      );
      setInput(content);
    } finally {
      setPending(false);
    }

    // New chats move to their own URL; existing ones refresh the sidebar order.
    if (id && id !== conversationId) router.replace(`/dashboard/assistant/${id}`);
    else router.refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-muted-foreground">Ask me anything to get started.</p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === "user"
                ? "ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-primary-foreground"
                : "mr-auto max-w-[85%] whitespace-pre-wrap rounded-lg bg-muted px-3 py-2"
            }
          >
            {message.content || "…"}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <form onSubmit={send} className="flex gap-2">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as Provider)}
          aria-label="Provider"
          disabled={pending}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {PROVIDER_LABELS[p]}
            </option>
          ))}
        </select>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Message your assistant"
          aria-label="Message"
          autoComplete="off"
        />
        <Button type="submit" disabled={pending || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
