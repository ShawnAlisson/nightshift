"use client";

import { Loader2, Monitor } from "lucide-react";
import { useDesktop } from "@/components/assistant/desktop-provider";
import { Button } from "@/components/ui/button";

/** Header button that shows or hides the assistant's desktop. */
export function DesktopToggle() {
  const { open, busy, toggle } = useDesktop();
  const starting = busy === "starting";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={open ? "Hide desktop" : "Show desktop"}
      aria-pressed={open}
      title="Desktop"
      onClick={toggle}
      disabled={busy !== undefined}
      className={open ? "bg-accent text-accent-foreground" : undefined}
    >
      {starting ? <Loader2 className="animate-spin" /> : <Monitor />}
    </Button>
  );
}
