import { z } from "zod";

export const PROVIDERS = ["anthropic", "openai", "gemini", "openrouter"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const MAX_MESSAGE_LENGTH = 8000;
/** Hard cap per conversation (user + assistant messages combined). */
export const MAX_MESSAGES = 100;

const conversationId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid conversation id");

export const MAX_TITLE_LENGTH = 80;
export const MAX_SEARCH_LENGTH = 100;

export const conversationIdSchema = conversationId;
export const conversationTitleSchema = z.string().trim().min(1, "Title is required").max(MAX_TITLE_LENGTH);
export const searchQuerySchema = z.string().trim().max(MAX_SEARCH_LENGTH);

export const chatSchema = z.object({
  conversationId: conversationId.optional(),
  content: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

export type ChatMessage = { role: "user" | "assistant"; content: string };
