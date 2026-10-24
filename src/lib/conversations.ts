import "server-only";
import { isValidObjectId } from "mongoose";
import { requireUserId } from "@/lib/dal";
import { Conversation } from "@/lib/models/conversation";
import { connectDB } from "@/lib/mongodb";
import type { ChatMessage } from "@/lib/validations/assistant";

const LIST_LIMIT = 50;

export type ConversationSummary = { id: string; title: string };
export type ConversationDetail = ConversationSummary & { messages: ChatMessage[] };

// Every query is scoped to the signed-in user, so one user can never read another's chats.

export async function listConversations(): Promise<ConversationSummary[]> {
  const userId = await requireUserId();
  await connectDB();

  const conversations = await Conversation.find({ userId })
    .select("title")
    .sort({ updatedAt: -1 })
    .limit(LIST_LIMIT)
    .lean();

  return conversations.map((c) => ({ id: c._id.toString(), title: c.title }));
}

export async function getConversation(id: string): Promise<ConversationDetail | null> {
  const userId = await requireUserId();
  if (!isValidObjectId(id)) return null;
  await connectDB();

  const conversation = await Conversation.findOne({ _id: id, userId }).lean();
  if (!conversation) return null;

  return {
    id: conversation._id.toString(),
    title: conversation.title,
    messages: conversation.messages.map(({ role, content }) => ({ role, content })),
  };
}
