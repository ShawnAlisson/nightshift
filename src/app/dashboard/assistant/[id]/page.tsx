import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Chat } from "@/components/assistant/chat";
import { getConversation } from "@/lib/conversations";

export const metadata: Metadata = { title: "Assistant" };

export default function ConversationPage({ params }: PageProps<"/dashboard/assistant/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
      <Conversation params={params} />
    </Suspense>
  );
}

async function Conversation({ params }: Pick<PageProps<"/dashboard/assistant/[id]">, "params">) {
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) notFound();

  return <Chat key={conversation.id} conversationId={conversation.id} initialMessages={conversation.messages} />;
}
