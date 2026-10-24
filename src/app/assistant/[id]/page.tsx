import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Chat } from "@/components/assistant/chat";
import { DesktopToggleSlot } from "@/components/assistant/desktop-toggle-slot";
import { ChatSkeleton } from "@/components/assistant/chat-skeleton";
import { getConversation } from "@/lib/conversations";
import { conversationIdSchema } from "@/lib/validations/assistant";

export const metadata: Metadata = { title: "Assistant" };

export default function ConversationPage({ params }: PageProps<"/assistant/[id]">) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <SavedConversation params={params} />
    </Suspense>
  );
}

async function SavedConversation({ params }: Pick<PageProps<"/assistant/[id]">, "params">) {
  const { id } = await params;
  // The id comes from the URL, so check its shape before it reaches the database.
  const conversation = conversationIdSchema.safeParse(id).success ? await getConversation(id) : null;
  if (!conversation) notFound();

  return (
    <Chat
      key={conversation.id}
      conversationId={conversation.id}
      initialMessages={conversation.messages}
      desktopToggle={<DesktopToggleSlot />}
    />
  );
}
