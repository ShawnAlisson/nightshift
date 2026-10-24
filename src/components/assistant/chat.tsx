"use client";

import { ArrowUp, SquarePen, Sparkles, Square } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_MESSAGE_LENGTH, type ChatMessage } from "@/lib/validations/assistant";

type ChatProps = {
  conversationId?: string;
  initialMessages?: ChatMessage[];
};

const GENERIC_ERROR = "The assistant couldn't respond. Please try again.";
const SUGGESTIONS = [
  "Help me plan my week",
  "Explain a concept simply",
  "Draft a polite email",
  "Brainstorm ideas with me",
];

export function Chat({ conversationId: initialId, initialMessages = [] }: ChatProps) {
  const [conversationId, setConversationId] = useState(initialId);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function appendToLast(text: string) {
    setMessages((current) => {
      const last = current[current.length - 1];
      return [...current.slice(0, -1), { ...last, content: last.content + text }];
    });
    bottomRef.current?.scrollIntoView({ block: "end" });
  }

  async function send(raw: string) {
    const content = raw.trim();
    if (!content || pending) return;

    setMessages((current) => [
      ...current,
      { role: "user", content },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setError(undefined);
    setPending(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, content }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const { error } = await response.json().catch(() => ({}));
        throw new Error(typeof error === "string" ? error : GENERIC_ERROR);
      }
      setConversationId(response.headers.get("X-Conversation-Id") ?? conversationId);

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        appendToLast(value);
      }
    } catch (err) {
      // Stopping on purpose is not an error: the server keeps the partial reply.
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : GENERIC_ERROR);
        // The server rolls back an unanswered message, so mirror that here.
        setMessages((current) => (current.at(-1)?.content === "" ? current.slice(0, -2) : current));
        setInput(content);
      }
    } finally {
      abortRef.current = null;
      setPending(false);
    }
  }

  function startNewChat() {
    setConversationId(undefined);
    setMessages([]);
    setError(undefined);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(input);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {messages.length > 0 && (
        <div className="flex justify-end pt-3">
          <Button variant="ghost" size="sm" onClick={startNewChat} disabled={pending}>
            <SquarePen />
            New chat
          </Button>
        </div>
      )}
      <div role="log" aria-live="polite" className="flex-1 overflow-y-auto py-6">
        {messages.length === 0 ? (
          <EmptyState onPick={(text) => void send(text)} />
        ) : (
          <div className="grid gap-5">
            {messages.map((message, index) => (
              <Message key={index} message={message} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p role="alert" className="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        className="rounded-2xl bg-card p-2 shadow-sm ring-1 ring-foreground/10 focus-within:ring-2 focus-within:ring-ring"
      >
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={1}
          placeholder="Message your assistant…"
          aria-label="Message"
          className="max-h-40 min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          <p className="text-xs text-muted-foreground">Enter to send · Shift+Enter for a new line</p>
          {pending ? (
            <Button type="button" size="icon" variant="outline" aria-label="Stop" onClick={() => abortRef.current?.abort()}>
              <Square className="fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon" aria-label="Send" disabled={!input.trim()}>
              <ArrowUp />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Message({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground">
        {message.content}
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0 flex-1 whitespace-pre-wrap break-words pt-1 leading-relaxed">
        {message.content || <TypingDots />}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span role="status" aria-label="Assistant is typing" className="flex h-6 items-center gap-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Sparkles className="size-6" />
      </span>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">How can I help?</h1>
        <p className="mt-1 text-muted-foreground">Ask anything, or start with a suggestion.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((text) => (
          <Button key={text} variant="outline" size="sm" onClick={() => onPick(text)}>
            {text}
          </Button>
        ))}
      </div>
    </div>
  );
}
