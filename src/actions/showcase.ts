"use server";

import { requireUserId } from "@/lib/dal";
import { Conversation } from "@/lib/models/conversation";
import { connectDB } from "@/lib/mongodb";

// The text is fixed here on the server. The client sends nothing, so it can't write arbitrary chats.
const TITLE = "Order my usual groceries";
const MESSAGES = [
  { role: "user" as const, content: "Order the usual" },
  { role: "assistant" as const, content: "All done. Your order is confirmed for delivery tomorrow between 9 and 11." },
];

/** Makes sure the signed-in user has the sample chat, so searching for it finds something real. Safe to repeat. */
export async function ensureSampleConversation(): Promise<void> {
  const userId = await requireUserId();
  await connectDB();

  const exists = await Conversation.exists({ userId, title: TITLE, "messages.0.content": MESSAGES[0].content });
  if (!exists) await Conversation.create({ userId, title: TITLE, messages: MESSAGES });
}
