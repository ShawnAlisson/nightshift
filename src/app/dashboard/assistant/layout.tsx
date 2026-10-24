import Link from "next/link";
import { Suspense } from "react";
import { ConversationList } from "@/components/assistant/conversation-list";
import { buttonVariants } from "@/components/ui/button";

export default function AssistantLayout({ children }: LayoutProps<"/dashboard/assistant">) {
  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <aside className="flex max-h-48 flex-col gap-3 overflow-y-auto border-b p-3 md:max-h-none md:w-64 md:border-r md:border-b-0">
        <Link href="/dashboard" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Dashboard
        </Link>
        <Link href="/dashboard/assistant" className={buttonVariants({ variant: "outline" })}>
          New chat
        </Link>
        <Suspense fallback={<p className="px-2 text-sm text-muted-foreground">Loading…</p>}>
          <ConversationList />
        </Suspense>
      </aside>
      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col p-4">{children}</main>
    </div>
  );
}
