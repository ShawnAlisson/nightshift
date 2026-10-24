"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatMessage } from "@/lib/validations/assistant";
import { MAX_MESSAGE_LENGTH } from "@/lib/validations/assistant";

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const content = input.trim();
    if (!content || pending) return;

    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setError(undefined);
    setPending(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!response.ok || !response.body) throw new Error(String(response.status));

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setMessages((current) => {
          const last = current[current.length - 1];
          return [...current.slice(0, -1), { ...last, content: last.content + value }];
        });
        bottomRef.current?.scrollIntoView({ block: "end" });
      }
    } catch {
      setError("The assistant couldn't respond. Please try again.");
      setMessages((current) => current.filter((m) => m.content !== ""));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-muted-foreground">Ask me anything to get started.</p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === "user"
                ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground"
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
