import { Loader2, Mic, MicOff, Volume2 } from "lucide-react";
import type { VoiceState } from "@/hooks/use-voice-mode";
import { cn } from "@/lib/utils";

const LABELS: Record<Exclude<VoiceState, "unsupported">, string> = {
  starting: "Getting ready…",
  listening: "Listening… just talk",
  thinking: "Working on it…",
  speaking: "Speaking… tap to interrupt",
  paused: "Tap to talk",
  off: "Tap to talk",
};

const BUTTON_LABELS: Record<Exclude<VoiceState, "unsupported">, string> = {
  starting: "Turn voice off",
  listening: "Stop listening",
  thinking: "Working on it",
  speaking: "Stop speaking",
  paused: "Turn voice on",
  off: "Turn voice on",
};

/** The big voice control at the centre of the empty screen. */
export function VoiceOrb({ state, onToggle }: { state: Exclude<VoiceState, "unsupported">; onToggle: () => void }) {
  const active = state === "listening";
  const muted = state === "off" || state === "paused";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {active && (
          <>
            <span aria-hidden className="absolute -inset-3 animate-ping rounded-full bg-primary/20" />
            <span aria-hidden className="absolute -inset-6 animate-pulse rounded-full bg-primary/10" />
          </>
        )}
        <button
          type="button"
          onClick={onToggle}
          disabled={state === "thinking"}
          aria-label={BUTTON_LABELS[state]}
          aria-pressed={!muted}
          className={cn(
            "relative flex size-24 items-center justify-center rounded-full shadow-lg ring-1 transition-colors focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-wait",
            muted
              ? "bg-muted text-muted-foreground ring-foreground/10 hover:bg-accent"
              : "bg-primary text-primary-foreground ring-primary/30",
          )}
        >
          {state === "thinking" ? (
            <Loader2 className="size-9 animate-spin" />
          ) : state === "speaking" ? (
            <Volume2 className="size-9" />
          ) : muted ? (
            <MicOff className="size-9" />
          ) : (
            <Mic className="size-9" />
          )}
        </button>
      </div>
      <p role="status" className="text-sm font-medium text-muted-foreground">
        {LABELS[state]}
      </p>
    </div>
  );
}
