import { z } from "zod";

export const PROVIDERS = ["anthropic", "openai", "gemini", "openrouter"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
  openrouter: "OpenRouter",
};

export const MAX_MESSAGE_LENGTH = 8000;
/** Hard cap per conversation (user + assistant messages combined). */
export const MAX_MESSAGES = 100;

export const chatSchema = z.object({
  conversationId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Invalid conversation id")
    .optional(),
  provider: z.enum(PROVIDERS),
  content: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

export type ChatMessage = { role: "user" | "assistant"; content: string };
