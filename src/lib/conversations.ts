import "server-only";
import { requireUserId } from "@/lib/dal";
import { Conversation } from "@/lib/models/conversation";
import { connectDB } from "@/lib/mongodb";
import type { ChatMessage } from "@/lib/validations/assistant";

export type ConversationDetail = { id: string; messages: ChatMessage[] };

/** The signed-in user's most recent conversation, which the assistant resumes. */
export async function getLatestConversation(): Promise<ConversationDetail | null> {
  const userId = await requireUserId();
  await connectDB();

  const conversation = await Conversation.findOne({ userId }).sort({ updatedAt: -1 }).lean();
  if (!conversation) return null;

  return {
    id: conversation._id.toString(),
    messages: conversation.messages.map(({ role, content }) => ({ role, content })),
  };
}
