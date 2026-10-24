"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const subscribeNever = () => () => {};
const MAX_CHUNK = 180;

/** Plain text a voice can read: no markdown marks, split at sentence ends (long utterances get cut off by some browsers). */
export function toSpeakable(text: string) {
  // A line break becomes a pause: a full stop, unless the line already ended with punctuation.
  const plain = text
    .replace(/[*_`#>]+/g, "")
    .replace(/([.!?])?[ \t]*\n+\s*/g, (_, mark) => `${mark ?? "."} `)
    .trim();
  const sentences = plain.match(/[^.!?]+[.!?]*\s*/g) ?? [];

  const chunks: string[] = [];
  for (const sentence of sentences) {
    const last = chunks.length - 1;
    if (last >= 0 && chunks[last].length + sentence.length <= MAX_CHUNK) chunks[last] += sentence;
    else chunks.push(sentence);
  }
  return chunks.map((chunk) => chunk.trim()).filter(Boolean);
}

/** Browser text-to-speech. */
export function useSpeechSynthesis() {
  const supported = useSyncExternalStore(subscribeNever, () => "speechSynthesis" in window, () => false);
  const [speaking, setSpeaking] = useState(false);
  // Browsers refuse to speak until the person has touched the page once.
  const [blocked, setBlocked] = useState(false);
  // Late events from a cancelled utterance must not undo a newer one.
  const generation = useRef(0);

  const cancel = useCallback(() => {
    generation.current += 1;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    const chunks = toSpeakable(text);
    if (chunks.length === 0) return;

    window.speechSynthesis.cancel();
    const current = ++generation.current;
    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = navigator.language || "en-US";
      if (index === 0) {
        utterance.onstart = () => {
          if (generation.current !== current) return;
          setBlocked(false);
          setSpeaking(true);
        };
      }
      if (index === chunks.length - 1) {
        utterance.onend = () => generation.current === current && setSpeaking(false);
      }
      utterance.onerror = (event) => {
        if (generation.current !== current) return;
        if (event.error === "not-allowed") setBlocked(true);
        setSpeaking(false);
      };
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  // The first touch or key press lets the browser speak later, so unlock on it.
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const unlock = () => window.speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.speechSynthesis.cancel();
    };
  }, []);

  return { supported, speaking, blocked, speak, cancel };
}
