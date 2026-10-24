"use server";

import { searchConversations as search, type ConversationSummary } from "@/lib/conversations";
import { requireUserId } from "@/lib/dal";
import { Conversation } from "@/lib/models/conversation";
import { connectDB } from "@/lib/mongodb";
import {
  conversationIdSchema,
  conversationTitleSchema,
  searchQuerySchema,
} from "@/lib/validations/assistant";

// Server actions are public endpoints: every argument is validated and every query is user-scoped.

export async function searchConversations(query: string): Promise<ConversationSummary[]> {
  const parsed = searchQuerySchema.safeParse(query);
  return parsed.success ? search(parsed.data) : [];
}

export async function renameConversation(id: string, title: string): Promise<{ title: string } | { error: string }> {
  const userId = await requireUserId();
  const parsedId = conversationIdSchema.safeParse(id);
  const parsedTitle = conversationTitleSchema.safeParse(title);
  if (!parsedId.success || !parsedTitle.success) return { error: "Enter a title up to 80 characters" };

  await connectDB();
  // timestamps: false, so renaming does not move the conversation to the top.
  const result = await Conversation.updateOne(
    { _id: parsedId.data, userId },
    { title: parsedTitle.data },
    { timestamps: false },
  );
  return result.matchedCount ? { title: parsedTitle.data } : { error: "Conversation not found" };
}

export async function deleteConversation(id: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const parsedId = conversationIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false };

  await connectDB();
  const result = await Conversation.deleteOne({ _id: parsedId.data, userId });
  return { ok: result.deletedCount === 1 };
}
