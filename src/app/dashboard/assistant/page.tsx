import type { Metadata } from "next";
import Link from "next/link";
import { Chat } from "@/components/assistant/chat";

export const metadata: Metadata = { title: "Assistant" };

export default function AssistantPage() {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-2xl flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Assistant</h1>
        <Link href="/dashboard" className="text-sm text-muted-foreground underline underline-offset-4">
          Back
        </Link>
      </header>
      <Chat />
    </main>
  );
}
