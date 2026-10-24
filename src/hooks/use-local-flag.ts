"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read(key: string, fallback: boolean) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : stored === "true";
  } catch {
    return fallback; // storage can be blocked
  }
}

/** A boolean setting remembered in this browser. Starts at `fallback` on the server. */
export function useLocalFlag(key: string, fallback = false) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );

  function set(next: boolean) {
    try {
      localStorage.setItem(key, String(next));
    } catch {
      // Storage is blocked, so the setting can't be remembered.
    }
    listeners.forEach((listener) => listener());
  }

  return [value, set] as const;
}
