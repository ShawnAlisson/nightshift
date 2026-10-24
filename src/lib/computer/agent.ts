import "server-only";
import { getOpenAIClient, getProvider } from "@/lib/ai";
import type { AssistantEvent } from "@/lib/assistant-events";
import { runAnthropicAgent } from "@/lib/computer/anthropic-agent";
import { DesktopLease } from "@/lib/computer/desktop";
import { runGeminiAgent } from "@/lib/computer/gemini-agent";
import { runOpenAIAgent } from "@/lib/computer/openai-agent";
import type { ChatMessage } from "@/lib/validations/assistant";

/**
 * Runs the assistant with a desktop it can operate, using the same provider and
 * model as plain chat. The desktop only starts when the model first asks for it.
 */
export function runComputerAgent(
  history: ChatMessage[],
  userId: string,
  signal: AbortSignal,
): AsyncGenerator<AssistantEvent> {
  const desktops = new DesktopLease(userId);
  const provider = getProvider();

  // Claude and Gemini have native computer-use tools; every other provider uses function calling.
  if (provider === "anthropic") return runAnthropicAgent(history, desktops, signal);
  if (provider === "gemini") return runGeminiAgent(history, desktops, signal);
  return runOpenAIAgent(getOpenAIClient(provider), provider, history, desktops, signal);
}
