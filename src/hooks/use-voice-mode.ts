"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalFlag } from "@/hooks/use-local-flag";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";

const LISTEN_DELAY_MS = 350;
// After this many empty listening sessions in a row, wait for a tap instead of listening forever.
const MAX_SILENT_SESSIONS = 3;

export type VoiceState = "unsupported" | "off" | "starting" | "listening" | "thinking" | "speaking" | "paused";

type Options = {
  /** The text box's current contents (kept when listening resumes). */
  input: string;
  onInput: (text: string) => void;
  /** True while the assistant is working. Nothing is heard until it finishes. */
  busy: boolean;
  /** Called with what was said when it should be sent. */
  onSubmit: (text: string) => void;
};

/**
 * Voice-first behaviour: listen as soon as the page opens, send when the person stops
 * talking, read the answer aloud, then listen again.
 */
export function useVoiceMode({ input, onInput, busy, onSubmit }: Options) {
  const [on, setOn] = useLocalFlag("voice-on", true);
  const [autoSend, setAutoSend] = useLocalFlag("voice-auto-send", true);
  const [speakReplies, setSpeakReplies] = useLocalFlag("voice-speak", true);
  const [paused, setPaused] = useState(false);
  const silentSessions = useRef(0);
  const inputRef = useRef(input);
  useEffect(() => {
    inputRef.current = input;
  });

  const tts = useSpeechSynthesis();
  const speech = useSpeechRecognition({
    onTranscript: onInput,
    onEnd: (fullText, spoken) => {
      if (!spoken) {
        silentSessions.current += 1;
        if (silentSessions.current >= MAX_SILENT_SESSIONS) setPaused(true);
        return;
      }
      silentSessions.current = 0;
      if (autoSend) onSubmit(fullText);
    },
  });
  const { start: startListening, listening, supported, denied } = speech;

  const canListen = on && supported && !denied && !paused && !busy && !tts.speaking && !listening;
  useEffect(() => {
    if (!canListen) return;
    const timer = setTimeout(() => startListening(inputRef.current), LISTEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [canListen, startListening]);

  // Speech can start a moment after listening resumes. Stop listening so the mic never hears the assistant.
  const { cancel: cancelListening } = speech;
  const speaking = tts.speaking;
  useEffect(() => {
    if (speaking && listening) cancelListening();
  }, [speaking, listening, cancelListening]);

  const state: VoiceState = !supported
    ? "unsupported"
    : listening
      ? "listening"
      : tts.speaking
        ? "speaking"
        : busy
          ? "thinking"
          : !on || denied
            ? "off"
            : paused
              ? "paused"
              : "starting";

  /** The mic button: interrupt speech, stop listening (and stay off), or turn voice back on. */
  function toggle() {
    if (tts.speaking) return tts.cancel();
    if (listening) {
      setOn(false);
      return speech.stop();
    }
    silentSessions.current = 0;
    setPaused(false);
    setOn(true);
  }

  /** The person sent a message another way (keyboard, card): stop listening and speaking. */
  function interrupt() {
    speech.cancel();
    tts.cancel();
    silentSessions.current = 0;
    setPaused(false);
  }

  /** The person is typing: stop listening until they send or tap the mic. */
  function typing() {
    if (listening) speech.cancel();
    setPaused(true);
  }

  return {
    supported,
    state,
    error: speech.error,
    speechBlocked: tts.blocked,
    autoSend,
    setAutoSend,
    speakReplies,
    setSpeakReplies,
    toggle,
    interrupt,
    typing,
    /** Read an answer aloud, if the person wants spoken replies. */
    speakReply: (text: string) => {
      if (on && speakReplies && !denied) tts.speak(text);
    },
  };
}
