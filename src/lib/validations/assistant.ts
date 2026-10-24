import { z } from "zod";

export const MAX_MESSAGE_LENGTH = 8000;

export const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
      }),
    )
    .min(1)
    .max(40)
    .refine((messages) => messages[0].role === "user" && messages.at(-1)?.role === "user", {
      message: "Conversation must start and end with a user message",
    }),
});

export type ChatMessage = z.infer<typeof chatSchema>["messages"][number];
