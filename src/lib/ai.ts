import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import type { AssistantEvent } from "@/lib/assistant-events";
import { PROVIDERS, type ChatMessage, type Provider } from "@/lib/validations/assistant";

// Mubit proxies each provider's native API; only the base URL changes.
const BASE_URLS: Record<Provider, string> = {
  anthropic: "https://api.mubit.ai/anthropic",
  openai: "https://api.mubit.ai/openai/v1",
  gemini: "https://api.mubit.ai/gemini",
  openrouter: "https://api.mubit.ai/compat/openrouter/v1",
};

const MODELS: Record<Provider, string> = {
  anthropic: process.env.MUBIT_ANTHROPIC_MODEL ?? "claude-haiku-4-5",
  openai: process.env.MUBIT_OPENAI_MODEL ?? "gpt-6-luna",
  gemini: process.env.MUBIT_GEMINI_MODEL ?? "gemini-3.8-flash",
  openrouter: process.env.MUBIT_OPENROUTER_MODEL ?? "anthropic/claude-haiku-4.5",
};

const SYSTEM_PROMPT =
  "You are a helpful, concise personal assistant. Answer clearly and ask a short clarifying question when a request is ambiguous.";
const MAX_OUTPUT_TOKENS = 1024;

type Streamer = (messages: ChatMessage[], signal: AbortSignal) => AsyncGenerator<string>;

function getApiKey() {
  const apiKey = process.env.MUBIT_API_KEY;
  if (!apiKey) throw new Error("MUBIT_API_KEY is not set in .env.local");
  return apiKey;
}

export type OpenAICompatibleProvider = "openai" | "openrouter";

/** OpenAI-compatible client routed through Mubit. Also used by the computer-use agent. */
export function getOpenAIClient(provider: OpenAICompatibleProvider) {
  return new OpenAI({ baseURL: BASE_URLS[provider], apiKey: getApiKey() });
}

/**
 * Without an output limit, OpenRouter reserves the model's maximum output (tens of
 * thousands of tokens) and refuses the call if your credit can't cover that.
 * OpenAI's newer models only accept the `max_completion_tokens` spelling.
 */
export const outputTokenLimit = (provider: OpenAICompatibleProvider, tokens: number) =>
  provider === "openrouter" ? { max_tokens: tokens } : { max_completion_tokens: tokens };

/** Shared by every OpenAI-compatible endpoint (OpenAI itself and OpenRouter). */
async function* streamOpenAICompatible(
  provider: OpenAICompatibleProvider,
  messages: ChatMessage[],
  signal: AbortSignal,
) {
  const stream = await getOpenAIClient(provider).chat.completions.create(
    {
      model: MODELS[provider],
      stream: true,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      ...outputTokenLimit(provider, MAX_OUTPUT_TOKENS),
    },
    { signal },
  );
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

export const getModel = (provider: Provider) => MODELS[provider];

/** Gemini client routed through Mubit. Also used by the computer-use agent. */
export function getGeminiClient() {
  return new GoogleGenAI({ apiKey: getApiKey(), httpOptions: { baseUrl: BASE_URLS.gemini } });
}

/** Anthropic client routed through Mubit. Also used by the computer-use agent. */
export function getAnthropicClient() {
  return new Anthropic({ baseURL: BASE_URLS.anthropic, apiKey: getApiKey() });
}

const streamers: Record<Provider, Streamer> = {
  async *anthropic(messages, signal) {
    const stream = getAnthropicClient().messages.stream(
      { model: MODELS.anthropic, max_tokens: MAX_OUTPUT_TOKENS, system: SYSTEM_PROMPT, messages },
      { signal },
    );
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  },

  openai: (messages, signal) => streamOpenAICompatible("openai", messages, signal),
  openrouter: (messages, signal) => streamOpenAICompatible("openrouter", messages, signal),

  async *gemini(messages, signal) {
    const stream = await getGeminiClient().models.generateContentStream({
      model: MODELS.gemini,
      contents: messages.map(({ role, content }) => ({
        role: role === "assistant" ? "model" : "user",
        parts: [{ text: content }],
      })),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        abortSignal: signal,
      },
    });
    for await (const chunk of stream) {
      if (chunk.text) yield chunk.text;
    }
  },
};

export function getProvider(): Provider {
  const configured = process.env.MUBIT_PROVIDER ?? "anthropic";
  if (!(PROVIDERS as readonly string[]).includes(configured)) {
    throw new Error(`MUBIT_PROVIDER must be one of: ${PROVIDERS.join(", ")}`);
  }
  return configured as Provider;
}

/** Streams the assistant's reply as text chunks from the configured provider, via Mubit. */
export async function* streamChat(messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<AssistantEvent> {
  for await (const text of streamers[getProvider()](messages, signal)) {
    yield { type: "text", text };
  }
}
