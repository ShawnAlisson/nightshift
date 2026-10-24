import { Loader2, Power, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type DesktopPanelProps = {
  url: string;
  stopping: boolean;
  onHide: () => void;
  onStop: () => void;
};

/**
 * The assistant's desktop, framed like a small window. Beside the chat on large
 * screens, above it on small ones.
 */
export function DesktopPanel({ url, stopping, onHide, onStop }: DesktopPanelProps) {
  return (
    <section
      aria-label="Assistant desktop"
      className="order-first flex h-[36dvh] shrink-0 flex-col overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10 lg:order-last lg:h-auto lg:min-h-0 lg:flex-[1.2]"
    >
      <header className="flex items-center gap-3 border-b bg-muted/40 py-1.5 pr-1.5 pl-3">
        <h2 className="flex-1 text-xs font-medium text-muted-foreground">Desktop</h2>
        <Button variant="ghost" size="icon-sm" aria-label="Stop desktop" title="Stop desktop" onClick={onStop} disabled={stopping}>
          {stopping ? <Loader2 className="animate-spin" /> : <Power />}
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Hide desktop" title="Hide desktop" onClick={onHide}>
          <X />
        </Button>
      </header>
      <div className="min-h-0 flex-1 p-3">
        <iframe
          src={url}
          title="Assistant desktop"
          allow="clipboard-read; clipboard-write"
          className="size-full rounded-lg bg-[#14121c]"
        />
      </div>
    </section>
  );
}
