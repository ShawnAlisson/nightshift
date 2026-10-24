import type { Metadata } from "next";
import { Suspense } from "react";
import { Chat } from "@/components/assistant/chat";
import { Skeleton } from "@/components/ui/skeleton";
import { getLatestConversation } from "@/lib/conversations";

export const metadata: Metadata = { title: "Assistant" };

export default function AssistantPage() {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <LatestChat />
    </Suspense>
  );
}

async function LatestChat() {
  const conversation = await getLatestConversation();
  return <Chat conversationId={conversation?.id} initialMessages={conversation?.messages} />;
}

function ChatSkeleton() {
  return (
    <div className="grid gap-5 py-6" aria-hidden>
      <Skeleton className="ml-auto h-10 w-2/5" />
      <Skeleton className="h-20 w-4/5" />
    </div>
  );
}
