"use client";

import { ArrowUp, Loader2, Mic, Sparkles, Square, SquarePen, Zap } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useDesktop } from "@/components/assistant/desktop-provider";
import { DesktopPanel } from "@/components/assistant/desktop-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLocalFlag } from "@/hooks/use-local-flag";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import type { AssistantEvent } from "@/lib/assistant-events";
import { errorFrom } from "@/lib/http";
import { cn } from "@/lib/utils";
import { MAX_MESSAGE_LENGTH, type ChatMessage } from "@/lib/validations/assistant";

type ChatProps = {
  conversationId?: string;
  initialMessages?: ChatMessage[];
  /** The desktop button, shown only when computer use is on. Passed in because that is decided on the server. */
  desktopToggle?: React.ReactNode;
};

const GENERIC_ERROR = "The assistant couldn't respond. Please try again.";
const SUGGESTIONS = [
  "Help me plan my week",
  "Explain a concept simply",
  "Draft a polite email",
  "Brainstorm ideas with me",
];

export function Chat({ conversationId: initialId, initialMessages = [], desktopToggle }: ChatProps) {
  const desktop = useDesktop();
  const router = useRouter();
  const pathname = usePathname();
  const [conversationId, setConversationId] = useState(initialId);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [activity, setActivity] = useState<string>();
  const [error, setError] = useState<string>();
  const [autoSend, setAutoSend] = useLocalFlag("voice-auto-send");
  const speech = useSpeechRecognition({
    onTranscript: setInput,
    onEnd: (fullText, spoken) => {
      if (autoSend && spoken) void send(fullText);
    },
  });
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function appendToLast(text: string) {
    setMessages((current) => {
      const last = current[current.length - 1];
      return [...current.slice(0, -1), { ...last, content: last.content + text }];
    });
    bottomRef.current?.scrollIntoView({ block: "end" });
  }

  function handleEvent(event: AssistantEvent) {
    if (event.type === "text") appendToLast(event.text);
    else if (event.type === "action") setActivity(event.label);
    else if (event.type === "desktop") desktop.ready(event.url);
  }

  async function send(raw: string) {
    const content = raw.trim();
    if (!content || pending) return;
    speech.cancel();

    setMessages((current) => [
      ...current,
      { role: "user", content },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setError(undefined);
    setActivity(undefined);
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
      if (!response.ok || !response.body) throw new Error(await errorFrom(response, GENERIC_ERROR));
      const id = response.headers.get("X-Conversation-Id") ?? conversationId;
      setConversationId(id);
      // A new chat now has an address: put it in the URL without remounting, so a reload reopens it.
      if (id && id !== conversationId) window.history.replaceState(null, "", `/assistant/${id}`);

      // The stream is one JSON event per line.
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = (buffer + value).split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line) handleEvent(JSON.parse(line));
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
      setActivity(undefined);
      setPending(false);
    }
  }

  function startNewChat() {
    setConversationId(undefined);
    setMessages([]);
    setError(undefined);
    if (pathname !== "/assistant") router.push("/assistant");
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(input);
    }
  }

  const desktopUrl = desktop.open ? desktop.url : undefined;
  const visibleError = error ?? desktop.error ?? speech.error;
  const hasText = input.trim().length > 0;

  return (
    <div
      className={cn(
        "mx-auto flex min-h-0 w-full flex-1 flex-col gap-4 pt-4 lg:flex-row",
        desktopUrl ? "max-w-7xl" : "max-w-3xl",
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between">
          <div>{desktopToggle}</div>
          <Button variant="ghost" size="sm" onClick={startNewChat} disabled={pending || (messages.length === 0 && !conversationId)}>
            <SquarePen />
            New chat
          </Button>
        </div>

        <div role="log" aria-live="polite" className="flex-1 overflow-y-auto py-6">
          {messages.length === 0 ? (
            <EmptyState voice={speech.supported} onPick={(text) => void send(text)} />
          ) : (
            <div className="grid gap-5">
              {messages.map((message, index) => (
                <Message
                  key={index}
                  message={message}
                  activity={pending && index === messages.length - 1 ? activity : undefined}
                />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {visibleError && (
          <p role="alert" className="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {visibleError}
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
            readOnly={speech.listening}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={1}
            placeholder={speech.listening ? "Listening…" : "Message your assistant…"}
            aria-label="Message"
            className="max-h-40 min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {speech.listening
                ? "Listening… speak now"
                : speech.supported
                  ? "Tap the mic to talk, or type · Enter to send"
                  : "Enter to send · Shift+Enter for a new line"}
            </p>
            <div className="flex items-center gap-1.5">
              {speech.supported && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-pressed={autoSend}
                  title="Send as soon as you stop talking"
                  onClick={() => setAutoSend(!autoSend)}
                  className={cn("text-muted-foreground", autoSend && "bg-accent text-accent-foreground")}
                >
                  <Zap />
                  Auto-send
                </Button>
              )}
              {speech.supported && (
                <Button
                  type="button"
                  // The mic is the main control until there is text to send.
                  size={hasText || pending ? "icon" : "icon-lg"}
                  variant={speech.listening ? "destructive" : hasText || pending ? "ghost" : "default"}
                  aria-label={speech.listening ? "Stop listening" : "Start voice input"}
                  aria-pressed={speech.listening}
                  disabled={pending}
                  onClick={() => (speech.listening ? speech.stop() : speech.start(input))}
                  className="relative"
                >
                  {speech.listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-lg bg-destructive/30" />}
                  <Mic />
                </Button>
              )}
              {pending ? (
                <Button type="button" size="icon" variant="outline" aria-label="Stop" onClick={() => abortRef.current?.abort()}>
                  <Square className="fill-current" />
                </Button>
              ) : (
                (hasText || !speech.supported) && (
                  <Button type="submit" size="icon" aria-label="Send" disabled={!hasText}>
                    <ArrowUp />
                  </Button>
                )
              )}
            </div>
          </div>
        </form>
      </div>

      {desktopUrl && (
        <DesktopPanel url={desktopUrl} stopping={desktop.busy === "stopping"} onHide={desktop.hide} onStop={desktop.stop} />
      )}
    </div>
  );
}

function Message({ message, activity }: { message: ChatMessage; activity?: string }) {
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
      <div className="min-w-0 flex-1 pt-1 leading-relaxed">
        <div className="whitespace-pre-wrap break-words">
          {message.content || (activity ? null : <TypingDots />)}
        </div>
        {activity && (
          <p role="status" className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {activity}…
          </p>
        )}
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

function EmptyState({ onPick, voice }: { onPick: (text: string) => void; voice: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Sparkles className="size-6" />
      </span>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">How can I help?</h1>
        <p className="mt-1 text-muted-foreground">
          {voice ? "Tap the mic and just talk, or type." : "Ask anything, or start with a suggestion."}
        </p>
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
