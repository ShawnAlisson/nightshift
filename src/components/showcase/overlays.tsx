"use client";

import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addExampleRoutines } from "@/actions/routines";
import { Button } from "@/components/ui/button";
import type { ShowcaseView } from "@/hooks/use-showcase";

const TRY_IT = [
  "Open Routines, add one called Weekly groceries, and give it the phrase “the usual”. Then just say it.",
  "Tap the big mic, or simply start talking. Voice is already on.",
  "Press ⌘K (Ctrl K on Windows) to search, rename or delete any chat.",
  "Use the Desktop button to watch the assistant's own computer.",
  "Say “yes” when it asks. It never pays or sends anything without asking you first.",
];

/** A line of narration along the bottom while the run plays, and a way to stop it. */
export function Narration({ view, onStop }: { view: ShowcaseView; onStop: () => void }) {
  if (!view.active || view.ending) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-28 z-30 flex justify-center px-4">
        {view.caption && (
          <div
            role="status"
            aria-live="polite"
            className="flex max-w-xl flex-col items-center gap-2 rounded-2xl bg-foreground/90 px-5 py-3 text-center text-background shadow-xl backdrop-blur"
          >
            <p className="text-base font-medium text-balance">{view.caption.text}</p>
            {view.caption.tags.length > 0 && (
              <ul className="flex flex-wrap justify-center gap-1.5">
                {view.caption.tags.map((tag) => (
                  <li key={tag} className="rounded-full bg-background/20 px-2.5 py-0.5 text-xs font-medium">
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="fixed right-4 bottom-4 z-30 bg-background/90 backdrop-blur"
        onClick={onStop}
        title="Press Escape to stop"
      >
        <X />
        Stop
      </Button>
    </>
  );
}

/** Shown when the run ends: how anyone can try each thing for themselves. */
export function TryItPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  async function addExamples() {
    setAdding(true);
    await addExampleRoutines().catch(() => undefined);
    router.refresh();
    setAdding(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="try-heading" className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl ring-1 ring-foreground/10">
        <h2 id="try-heading" className="text-xl font-semibold tracking-tight">
          Now try it yourself
        </h2>
        <ol className="mt-4 grid gap-3">
          {TRY_IT.map((line, index) => (
            <li key={line} className="flex gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                {index + 1}
              </span>
              <span className="pt-0.5 text-muted-foreground">{line}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="lg" onClick={addExamples} disabled={adding}>
            {adding ? <Loader2 className="animate-spin" /> : null}
            Add example routines
          </Button>
          <Button size="lg" onClick={onClose} autoFocus>
            <Check />
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
