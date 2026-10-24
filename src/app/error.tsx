"use client";

import { Button } from "@/components/ui/button";

export default function Error({ retry }: { error: Error; retry: () => void }) {
  return (
    <main id="main" className="bg-glow flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-sm text-muted-foreground">An unexpected error occurred. Please try again.</p>
      <Button size="lg" onClick={() => retry()}>
        Try again
      </Button>
    </main>
  );
}
