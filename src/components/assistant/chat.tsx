"use client";

import { ArrowUp, Loader2, Mic, MicOff, Sparkles, Square, SquarePen, Volume2, VolumeX, Zap } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ChatActionsProvider } from "@/components/assistant/chat-actions";
import { useDesktop } from "@/components/assistant/desktop-provider";
import { DesktopPanel } from "@/components/assistant/desktop-panel";
import { VoiceOrb } from "@/components/assistant/voice-orb";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useVoiceMode, type VoiceState } from "@/hooks/use-voice-mode";
import type { AssistantEvent } from "@/lib/assistant-events";
import { errorFrom } from "@/lib/http";
import { cn } from "@/lib/utils";
import { MAX_MESSAGE_LENGTH, type ChatMessage } from "@/lib/validations/assistant";

type ChatProps = {
  conversationId?: string;
  initialMessages?: ChatMessage[];
  /** The desktop button, shown only when computer use is on. Passed in because that is decided on the server. */
  desktopToggle?: React.ReactNode;
  /** Reminder cards for the empty screen. Passed in because they are loaded on the server. */
  proactive?: React.ReactNode;
};

const GENERIC_ERROR = "The assistant couldn't respond. Please try again.";
const SUGGESTIONS = [
  "Order my usual groceries",
  "What's due this week?",
  "Check my electricity bill",
  "Reorder my prescription",
];

export function Chat({ conversationId: initialId, initialMessages = [], desktopToggle, proactive }: ChatProps) {
  const desktop = useDesktop();
  const router = useRouter();
  const pathname = usePathname();
  const [conversationId, setConversationId] = useState(initialId);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [activity, setActivity] = useState<string>();
  const [error, setError] = useState<string>();
  const voice = useVoiceMode({ input, onInput: setInput, busy: pending, onSubmit: (text) => void send(text) });
  const abortRef = useRef<AbortController | null>(null);
  // What the assistant said since its last action: that is the answer worth reading aloud.
  const answerRef = useRef("");
  // Whether any reply text arrived, which decides if a failure left something worth keeping.
  const gotTextRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function appendToLast(text: string) {
    answerRef.current += text;
    gotTextRef.current = true;
    setMessages((current) => {
      const last = current[current.length - 1];
      return [...current.slice(0, -1), { ...last, content: last.content + text }];
    });
    bottomRef.current?.scrollIntoView({ block: "end" });
  }

  function handleEvent(event: AssistantEvent) {
    if (event.type === "text") appendToLast(event.text);
    else if (event.type === "action") {
      setActivity(event.label);
      answerRef.current = "";
    }
    else if (event.type === "desktop") desktop.ready(event.url);
  }

  async function send(raw: string) {
    const content = raw.trim();
    if (!content || pending) return;
    voice.interrupt();
    answerRef.current = "";
    gotTextRef.current = false;

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
        for (const line of lines) {
          if (!line) continue;
          const event: AssistantEvent = JSON.parse(line);
          // A failure mid-reply arrives as an event; handle it like any other failed send.
          if (event.type === "error") throw new Error(event.message);
          handleEvent(event);
        }
      }
      voice.speakReply(answerRef.current);
    } catch (err) {
      // Stopping on purpose is not an error: the server keeps the partial reply.
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : GENERIC_ERROR);
        // The server rolls back an unanswered message but keeps a partial reply, so mirror that here.
        if (!gotTextRef.current) {
          setMessages((current) => current.slice(0, -2));
          setInput(content);
        }
      }
    } finally {
      abortRef.current = null;
      setActivity(undefined);
      setPending(false);
    }
  }

  function startNewChat() {
    voice.interrupt();
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
  const visibleError = error ?? desktop.error ?? voice.error;
  const hasText = input.trim().length > 0;

  return (
    <ChatActionsProvider value={{ run: (text) => void send(text) }}>
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
              <EmptyState
                voice={voice.supported ? voice.state : undefined}
                onToggleVoice={voice.toggle}
                onPick={(text) => void send(text)}
                proactive={proactive}
              />
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
              onChange={(event) => {
                setInput(event.target.value);
                voice.typing();
              }}
              onKeyDown={onKeyDown}
              maxLength={MAX_MESSAGE_LENGTH}
              rows={1}
              placeholder={voice.state === "listening" ? "Listening…" : "Message your assistant…"}
              aria-label="Message"
              className="max-h-40 min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <div className="flex items-center justify-between gap-2 px-1 pt-1">
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {voice.speechBlocked
                  ? "Tap anywhere once so I can speak my replies."
                  : voice.state === "listening"
                    ? "Listening… just talk"
                    : voice.supported
                      ? "Voice is on · or type and press Enter"
                      : "Enter to send · Shift+Enter for a new line"}
              </p>
              <div className="flex items-center gap-1.5">
                {voice.supported && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-pressed={voice.speakReplies}
                      aria-label={voice.speakReplies ? "Turn spoken replies off" : "Turn spoken replies on"}
                      title="Read replies aloud"
                      onClick={() => voice.setSpeakReplies(!voice.speakReplies)}
                      className={cn("text-muted-foreground", voice.speakReplies && "bg-accent text-accent-foreground")}
                    >
                      {voice.speakReplies ? <Volume2 /> : <VolumeX />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      aria-pressed={voice.autoSend}
                      title="Send as soon as you stop talking"
                      onClick={() => voice.setAutoSend(!voice.autoSend)}
                      className={cn("text-muted-foreground", voice.autoSend && "bg-accent text-accent-foreground")}
                    >
                      <Zap />
                      Auto-send
                    </Button>
                    <Button
                      type="button"
                      // The mic is the main control until there is text to send.
                      size={hasText || pending ? "icon" : "icon-lg"}
                      variant={voice.state === "listening" ? "destructive" : hasText || pending ? "ghost" : "default"}
                      aria-label={voice.state === "listening" ? "Stop listening" : "Turn voice on"}
                      aria-pressed={voice.state === "listening"}
                      disabled={pending}
                      onClick={voice.toggle}
                      className="relative"
                    >
                      {voice.state === "listening" && (
                        <span aria-hidden className="absolute inset-0 animate-ping rounded-lg bg-destructive/30" />
                      )}
                      {voice.state === "off" || voice.state === "paused" ? <MicOff /> : <Mic />}
                    </Button>
                  </>
                )}
                {pending ? (
                  <Button type="button" size="icon" variant="outline" aria-label="Stop" onClick={() => abortRef.current?.abort()}>
                    <Square className="fill-current" />
                  </Button>
                ) : (
                  (hasText || !voice.supported) && (
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
    </ChatActionsProvider>
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

type EmptyStateProps = {
  /** Undefined when this browser can't do speech, so the orb is hidden. */
  voice?: VoiceState;
  onToggleVoice: () => void;
  onPick: (text: string) => void;
  proactive?: React.ReactNode;
};

function EmptyState({ voice, onToggleVoice, onPick, proactive }: EmptyStateProps) {
  return (
    // my-auto (not justify-center) keeps the top reachable when the cards make this taller than the screen.
    <div className="flex min-h-full flex-col items-center text-center">
      <div className="my-auto flex w-full flex-col items-center gap-8 py-4">
        {voice && voice !== "unsupported" ? (
          <VoiceOrb state={voice} onToggle={onToggleVoice} />
        ) : (
          <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Sparkles className="size-6" />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">How can I help?</h1>
          <p className="mt-1 text-muted-foreground">Just say what you need, or pick a card below.</p>
        </div>

        {proactive}

        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground">Try saying</p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((text) => (
              <Button key={text} variant="outline" onClick={() => onPick(text)}>
                {text}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
