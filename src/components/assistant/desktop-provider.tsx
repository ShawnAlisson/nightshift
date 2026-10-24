"use client";

import { createContext, useContext, useState } from "react";
import { errorFrom } from "@/lib/http";

type DesktopContextValue = {
  /** Live view address, once the desktop is running. */
  url?: string;
  /** Whether the desktop panel is showing. */
  open: boolean;
  busy?: "starting" | "stopping";
  error?: string;
  /** Header button: show the desktop (starting it if needed), or hide it. */
  toggle: () => Promise<void>;
  hide: () => void;
  stop: () => Promise<void>;
  /** The assistant started the desktop itself. */
  ready: (url: string) => void;
};

const DesktopContext = createContext<DesktopContextValue | null>(null);

export function useDesktop() {
  const value = useContext(DesktopContext);
  if (!value) throw new Error("useDesktop must be used inside <DesktopProvider>");
  return value;
}

/**
 * Holds the desktop's state above the pages, so the header button and the chat
 * share it and it survives switching conversations.
 */
export function DesktopProvider({ children }: { children: React.ReactNode }) {
  const [url, setUrl] = useState<string>();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<DesktopContextValue["busy"]>();
  const [error, setError] = useState<string>();

  async function toggle() {
    if (open) return setOpen(false);
    if (url) return setOpen(true);

    setBusy("starting");
    setError(undefined);
    try {
      const response = await fetch("/api/desktop", { method: "POST" });
      if (!response.ok) throw new Error(await errorFrom(response, "The desktop couldn't be started"));
      setUrl((await response.json()).url);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The desktop couldn't be started");
    } finally {
      setBusy(undefined);
    }
  }

  async function stop() {
    setBusy("stopping");
    await fetch("/api/desktop", { method: "DELETE" }).catch(() => undefined);
    setUrl(undefined);
    setOpen(false);
    setBusy(undefined);
  }

  return (
    <DesktopContext
      value={{
        url,
        open,
        busy,
        error,
        toggle,
        hide: () => setOpen(false),
        stop,
        ready: (readyUrl) => {
          setUrl(readyUrl);
          setOpen(true);
        },
      }}
    >
      {children}
    </DesktopContext>
  );
}
