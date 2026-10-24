"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ensureSampleConversation } from "@/actions/showcase";
import type { VoiceState } from "@/hooks/use-voice-mode";
import type { RoutineSummary } from "@/lib/routine-schedule";
import { isPaletteOpen, togglePalette, typeInPalette } from "@/lib/showcase/palette";
import type { LiveStep } from "@/lib/showcase/live-steps";
import { runScript } from "@/lib/showcase/runner";
import { buildDrawnScene, buildIntro, buildLiveScene, buildOutro } from "@/lib/showcase/script";
import { serverState, showcaseStore } from "@/lib/showcase/store";
import { INITIAL_DESKTOP, type DesktopState, type RunnerContext } from "@/lib/showcase/types";

/** What the script needs the chat screen to do. */
export type ShowcaseControls = {
  /** Back to an empty new conversation. */
  reset: () => void;
  setInput: (text: string) => void;
  addUser: (text: string) => void;
  appendAssistant: (chunk: string) => void;
  setActivity: (label: string | undefined) => void;
  replyDone: () => void;
  speak: (text: string) => void;
};

export type ShowcaseView = {
  active: boolean;
  /** The run reached its end and is showing the closing panel. */
  ending: boolean;
  caption?: { text: string; tags: string[] };
  voice?: VoiceState;
  cards: RoutineSummary[] | null;
  pressedCard?: string;
  desktop: DesktopState | null;
  /** The live desktop, when the run is on a real website. */
  liveUrl?: string;
};

const IDLE: ShowcaseView = { active: false, ending: false, cards: null, desktop: null };

// How long the live desktop gets to start before the run uses the drawn one instead.
const LIVE_DESKTOP_WAIT_MS = 35_000;

/**
 * Starts the user's real desktop and checks its browser really opens. Resolves to the live address, or
 * nothing if either fails, which sends the run to the drawn scene before the live one begins.
 */
async function warmUpLiveDesktop(signal: AbortSignal, onTouched: () => void): Promise<string | undefined> {
  try {
    const response = await fetch("/api/desktop", { method: "POST", signal });
    if (!response.ok) return undefined;
    const { url } = await response.json();
    if (typeof url !== "string") return undefined;

    onTouched();
    await runLiveStep("prepare", signal);
    // View only: the live desktop is driven by the walkthrough, and a mouse moving over the panel
    // would otherwise be sent to it and push the pointer around.
    return `${url}&view_only=true`;
  } catch {
    return undefined;
  }
}

const timeout = (ms: number) => new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms));

/** Runs one named step of the live walkthrough on the real desktop. Fire-and-forget callers pass no signal. */
async function runLiveStep(step: LiveStep, signal?: AbortSignal) {
  const response = await fetch("/api/showcase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step }),
    signal,
  });
  if (!response.ok) throw new Error(`Live step "${step}" failed`);
}

/** Whether a run is going, read from the shared store so the voice logic can stay quiet during one. */
export function useShowcaseActive() {
  return useSyncExternalStore(showcaseStore.subscribe, () => showcaseStore.getState().active, () => serverState.active);
}

/** Plays the scripted run on the real chat screen when the search box asks for it. */
export function useShowcase(controls: ShowcaseControls) {
  const [view, setView] = useState<ShowcaseView>(IDLE);
  const pending = useSyncExternalStore(showcaseStore.subscribe, () => showcaseStore.getState().pending, () => serverState.pending);
  const controlsRef = useRef(controls);
  const abortRef = useRef<AbortController | null>(null);
  // Set once the run has touched the real desktop, so stopping early can put its browser back.
  const usedLiveRef = useRef(false);
  const liveUrlRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    controlsRef.current = controls;
  });

  const patch = useCallback((changes: Partial<ShowcaseView>) => setView((current) => ({ ...current, ...changes })), []);

  /** Puts the screen back to normal. */
  const cleanUp = useCallback(() => {
    if (usedLiveRef.current) {
      usedLiveRef.current = false;
      // Don't leave a private window sitting on someone else's sign-in page.
      void runLiveStep("cleanup").catch(() => undefined);
    }
    if (isPaletteOpen()) togglePalette();
    controlsRef.current.reset();
    setView(IDLE);
    showcaseStore.setActive(false);
  }, []);

  const start = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    showcaseStore.setActive(true);
    setView({ ...IDLE, active: true });
    usedLiveRef.current = false;
    liveUrlRef.current = undefined;

    const c = () => controlsRef.current;
    const ctx: RunnerContext = {
      caption: (text, tags) => patch({ caption: { text, tags } }),
      clearCaption: () => patch({ caption: undefined }),
      voice: (voice) => patch({ voice }),
      cards: (cards) => patch({ cards }),
      pressCard: (pressedCard) => patch({ pressedCard }),
      removeCard: (id) => setView((v) => ({ ...v, cards: v.cards?.filter((card) => card.id !== id) ?? null })),
      input: (text) => c().setInput(text),
      user: (text) => c().addUser(text),
      assistant: (chunk) => c().appendAssistant(chunk),
      activity: (label) => c().setActivity(label),
      replyDone: () => c().replyDone(),
      speak: (text) => c().speak(text),
      live: (step) => runLiveStep(step, controller.signal),
      liveView: (show) => patch({ liveUrl: show ? liveUrlRef.current : undefined }),
      desktop: (changes) =>
        setView((v) => ({ ...v, desktop: changes === null ? null : { ...(v.desktop ?? INITIAL_DESKTOP), ...changes } })),
      reset: () => {
        c().reset();
        setView((v) => ({ ...v, cards: null, desktop: null, pressedCard: undefined, voice: undefined }));
      },
      palette: (action, text) => {
        if (action === "open" && !isPaletteOpen()) togglePalette();
        else if (action === "type" && text) typeInPalette(text);
        else if (action === "close" && isPaletteOpen()) togglePalette();
      },
      // If saving fails, the search simply finds nothing: the rest of the run is unaffected.
      save: () => ensureSampleConversation().catch(() => undefined),
      finish: () => patch({ ending: true, voice: undefined, caption: undefined }),
    };

    try {
      const now = new Date();
      // Start the real desktop in the background while the opening scene plays.
      const warmUp = warmUpLiveDesktop(controller.signal, () => {
        usedLiveRef.current = true;
      });
      await runScript(buildIntro(now), ctx, controller.signal);

      // If the desktop is still starting, say so rather than leaving the screen silent.
      let ready = false;
      void warmUp.then(() => (ready = true));
      await Promise.resolve();
      if (!ready) patch({ caption: { text: "Getting its private desktop ready…", tags: [] } });
      const liveUrl = await Promise.race([warmUp, timeout(LIVE_DESKTOP_WAIT_MS)]);

      // The real website when the live desktop is up; otherwise the drawn one, so it never fails.
      liveUrlRef.current = liveUrl;
      await runScript(liveUrl ? buildLiveScene() : buildDrawnScene(now), ctx, controller.signal);
      await runScript(buildOutro(), ctx, controller.signal);
    } catch (error) {
      const stopped = error instanceof DOMException && error.name === "AbortError";
      if (!stopped) {
        console.error("showcase failed", error);
        // A real website didn't respond. Say so for a moment instead of vanishing.
        patch({ liveUrl: undefined, caption: { text: "That website didn't respond this time. Run it again to retry.", tags: [] } });
        await new Promise((resolve) => setTimeout(resolve, 3_000));
      }
      // Stopped or broken: leave nothing half-drawn behind.
      if (abortRef.current === controller) cleanUp();
    }
  }, [patch, cleanUp]);

  const startRef = useRef(start);
  useEffect(() => {
    startRef.current = start;
  });

  // The search box asks (possibly before this screen exists); start as soon as it is here.
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      if (showcaseStore.take()) void startRef.current();
    }, 0);
    return () => clearTimeout(timer);
  }, [pending]);

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const close = useCallback(() => {
    abortRef.current = null;
    cleanUp();
  }, [cleanUp]);

  // Escape stops a run in progress.
  useEffect(() => {
    if (!view.active || view.ending) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && stop();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view.active, view.ending, stop]);

  // Leaving the page ends the run.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
      showcaseStore.setActive(false);
    },
    [],
  );

  return { view, stop, close };
}
