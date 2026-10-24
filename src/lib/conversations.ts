import "server-only";
import { requireUserId } from "@/lib/dal";
import { Conversation } from "@/lib/models/conversation";
import { connectDB } from "@/lib/mongodb";
import type { ChatMessage } from "@/lib/validations/assistant";

const LIST_LIMIT = 30;

export type ConversationSummary = { id: string; title: string };
export type ConversationDetail = ConversationSummary & { messages: ChatMessage[] };

// Every query is scoped to the signed-in user, so one user can never see another's chats.

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The user's conversations, newest first. A query matches titles and message text. */
export async function searchConversations(query = ""): Promise<ConversationSummary[]> {
  const userId = await requireUserId();
  await connectDB();

  // The query is escaped, so it is always matched as plain text and never as a pattern.
  const match = query ? new RegExp(escapeRegex(query), "i") : undefined;
  const conversations = await Conversation.find({
    userId,
    ...(match && { $or: [{ title: match }, { "messages.content": match }] }),
  })
    .select("title")
    .sort({ updatedAt: -1 })
    .limit(LIST_LIMIT)
    .lean();

  return conversations.map((c) => ({ id: c._id.toString(), title: c.title }));
}

export async function getConversation(id: string): Promise<ConversationDetail | null> {
  const userId = await requireUserId();
  await connectDB();

  const conversation = await Conversation.findOne({ _id: id, userId }).lean();
  if (!conversation) return null;

  return {
    id: conversation._id.toString(),
    title: conversation.title,
    messages: conversation.messages.map(({ role, content }) => ({ role, content })),
  };
}
