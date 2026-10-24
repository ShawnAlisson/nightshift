import type { VoiceState } from "@/hooks/use-voice-mode";
import type { RoutineSummary } from "@/lib/routine-schedule";
import type { LiveStep } from "@/lib/showcase/live-steps";

export type DesktopPage = "blank" | "store" | "checkout" | "confirmation" | "pharmacy";

/** Everything the mock desktop draws. The script changes it with small patches. */
export type DesktopState = {
  page: DesktopPage;
  /** How many products are in the basket. */
  basket: number;
  /** Canvas coordinates of the cursor. */
  cursor: { x: number; y: number };
  /** Counts clicks, so each one can show a ripple. */
  clicks: number;
  search: string;
  /** Password characters typed (shown as dots). */
  password: number;
  /** The assistant has handed control to the person. */
  handover: boolean;
  refillRequested: boolean;
};

export const INITIAL_DESKTOP: DesktopState = {
  page: "blank",
  basket: 0,
  cursor: { x: 640, y: 420 },
  clicks: 0,
  search: "",
  password: 0,
  handover: false,
  refillRequested: false,
};

export type Step =
  | { do: "caption"; text: string; tags?: string[] }
  | { do: "clearCaption" }
  | { do: "wait"; ms: number }
  | { do: "voice"; state: VoiceState | undefined }
  | { do: "cards"; cards: RoutineSummary[] | null }
  /** Press a card's button: it lights up, then runs. */
  | { do: "tapCard"; id: string }
  /** The person speaks: words appear live in the text box, then it is sent. */
  | { do: "user"; text: string }
  /** A message sent without speaking, as a tapped card does. */
  | { do: "send"; text: string }
  /** The assistant answers: streamed, and read aloud when spoken replies are on. */
  | { do: "assistant"; text: string }
  /** The assistant does something on the desktop, with a status label. */
  | { do: "act"; label: string; patch?: Partial<DesktopState>; ms?: number }
  | { do: "desktop"; patch: Partial<DesktopState> | null }
  /** A real action on the live desktop (the real-website part of the run). */
  | { do: "live"; step: LiveStep; label: string }
  /** Show or hide the live desktop panel. */
  | { do: "liveView"; show: boolean }
  | { do: "reset" }
  | { do: "palette"; query: string }
  | { do: "save" }
  | { do: "finish" };

/** What the runner can do. The React side implements these against the real chat screen. */
export type RunnerContext = {
  caption(text: string, tags: string[]): void;
  clearCaption(): void;
  voice(state: VoiceState | undefined): void;
  cards(cards: RoutineSummary[] | null): void;
  pressCard(id: string | undefined): void;
  removeCard(id: string): void;
  input(text: string): void;
  user(text: string): void;
  assistant(chunk: string): void;
  activity(label: string | undefined): void;
  replyDone(): void;
  speak(text: string): void;
  desktop(patch: Partial<DesktopState> | null): void;
  live(step: LiveStep): Promise<void>;
  liveView(show: boolean): void;
  reset(): void;
  palette(action: "open" | "type" | "close", text?: string): void;
  save(): Promise<void>;
  finish(): void;
};
