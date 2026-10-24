"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// The Web Speech API is not in TypeScript's DOM types, so declare the small part used here.
type SpeechEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionConstructor = new () => Recognition;

function getConstructor(): RecognitionConstructor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const subscribeNever = () => () => {};

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings to use voice.",
  "service-not-allowed": "Microphone access is blocked. Allow it in your browser's site settings to use voice.",
  "audio-capture": "No microphone was found.",
  network: "Voice input needs an internet connection.",
  "no-speech": "I didn't hear anything. Try again.",
};

type Options = {
  /** Called as words arrive, with the text before the mic was tapped plus what was just said. */
  onTranscript: (fullText: string) => void;
  /** Called when listening stops. `spoken` is empty if nothing was heard. */
  onEnd: (fullText: string, spoken: string) => void;
};

/** Browser speech-to-text. Unsupported browsers (such as Firefox) report `supported: false`. */
export function useSpeechRecognition({ onTranscript, onEnd }: Options) {
  // False on the server and during hydration, then the real answer: no mismatch.
  const supported = useSyncExternalStore(subscribeNever, () => !!getConstructor(), () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string>();
  const recognitionRef = useRef<Recognition | null>(null);
  const callbacks = useRef({ onTranscript, onEnd });

  // Always call the latest callbacks, without restarting the recognizer.
  useEffect(() => {
    callbacks.current = { onTranscript, onEnd };
  });
  useEffect(() => () => recognitionRef.current?.abort(), []);

  function start(existingText: string) {
    const Recognition = getConstructor();
    if (!Recognition || recognitionRef.current) return;

    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = false; // ends on its own after a pause
    recognition.interimResults = true; // show words while they are spoken

    const join = (spoken: string) => [existingText.trimEnd(), spoken].filter(Boolean).join(" ");
    let spoken = "";

    recognition.onresult = (event) => {
      spoken = Array.from(event.results, (result) => result[0].transcript).join("").trim();
      callbacks.current.onTranscript(join(spoken));
    };
    recognition.onerror = ({ error: code }) => {
      if (code !== "aborted") setError(ERRORS[code] ?? "Voice input stopped unexpectedly.");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      callbacks.current.onEnd(join(spoken), spoken);
    };

    setError(undefined);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  /** Stop and keep what was heard. */
  const stop = () => recognitionRef.current?.stop();

  /** Stop and drop the session without reporting a result (used when sending by keyboard). */
  function cancel() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onend = null;
    recognition.abort();
    recognitionRef.current = null;
    setListening(false);
  }

  return { supported, listening, error, start, stop, cancel };
}
