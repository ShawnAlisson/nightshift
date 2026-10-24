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

export const SPEAKABLE_STYLE =
  "Your replies are often read aloud, so write short, plain sentences. Do not use markdown, bullet points, tables or emoji.";

const SYSTEM_PROMPT = `You are a voice-first personal assistant for people with limited hand mobility. You help with everyday shopping and account tasks. Be warm, brief and clear, and ask one short question when a request is ambiguous. ${SPEAKABLE_STYLE}`;
const MAX_OUTPUT_TOKENS = 1024;

type Streamer = (messages: ChatMessage[], signal: AbortSignal, system: string) => AsyncGenerator<string>;

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
 * Request fields that differ by provider.
 *
 * Without an output limit, OpenRouter reserves the model's maximum output (tens of
 * thousands of tokens) and refuses the call if your credit can't cover that. OpenAI's
 * newer models only accept the `max_completion_tokens` spelling.
 *
 * MUBIT_OPENROUTER_PROVIDER (for example "google-vertex") restricts OpenRouter to that
 * provider. With a bring-your-own-key setup this stops requests from silently falling
 * back to OpenRouter's shared capacity, which spends OpenRouter credit.
 */
export function requestExtras(provider: OpenAICompatibleProvider, tokens: number): Record<string, unknown> {
  if (provider !== "openrouter") return { max_completion_tokens: tokens };
  const only = process.env.MUBIT_OPENROUTER_PROVIDER;
  return { max_tokens: tokens, ...(only && { provider: { only: [only] } }) };
}

/** Shared by every OpenAI-compatible endpoint (OpenAI itself and OpenRouter). */
async function* streamOpenAICompatible(
  provider: OpenAICompatibleProvider,
  messages: ChatMessage[],
  signal: AbortSignal,
  system: string,
) {
  const stream = await getOpenAIClient(provider).chat.completions.create(
    {
      model: MODELS[provider],
      stream: true,
      messages: [{ role: "system", content: system }, ...messages],
      ...requestExtras(provider, MAX_OUTPUT_TOKENS),
    },
    { signal },
  );
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

let warnedAboutDefaultModel = false;

export function getModel(provider: Provider) {
  // A silent default here once sent a Claude request to an account that only had a Gemini key.
  if (provider === "openrouter" && !process.env.MUBIT_OPENROUTER_MODEL && !warnedAboutDefaultModel) {
    warnedAboutDefaultModel = true;
    console.warn(`MUBIT_OPENROUTER_MODEL is not set, so OpenRouter is using the default "${MODELS.openrouter}". Set it to the model your key serves.`);
  }
  return MODELS[provider];
}

/** Gemini client routed through Mubit. Also used by the computer-use agent. */
export function getGeminiClient() {
  return new GoogleGenAI({ apiKey: getApiKey(), httpOptions: { baseUrl: BASE_URLS.gemini } });
}

/** Anthropic client routed through Mubit. Also used by the computer-use agent. */
export function getAnthropicClient() {
  return new Anthropic({ baseURL: BASE_URLS.anthropic, apiKey: getApiKey() });
}

const streamers: Record<Provider, Streamer> = {
  async *anthropic(messages, signal, system) {
    const stream = getAnthropicClient().messages.stream(
      { model: MODELS.anthropic, max_tokens: MAX_OUTPUT_TOKENS, system, messages },
      { signal },
    );
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  },

  openai: (messages, signal, system) => streamOpenAICompatible("openai", messages, signal, system),
  openrouter: (messages, signal, system) => streamOpenAICompatible("openrouter", messages, signal, system),

  async *gemini(messages, signal, system) {
    const stream = await getGeminiClient().models.generateContentStream({
      model: MODELS.gemini,
      contents: messages.map(({ role, content }) => ({
        role: role === "assistant" ? "model" : "user",
        parts: [{ text: content }],
      })),
      config: {
        systemInstruction: system,
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
export async function* streamChat(
  messages: ChatMessage[],
  signal: AbortSignal,
  extraSystem = "",
): AsyncGenerator<AssistantEvent> {
  const system = [SYSTEM_PROMPT, extraSystem].filter(Boolean).join("\n\n");
  for await (const text of streamers[getProvider()](messages, signal, system)) {
    yield { type: "text", text };
  }
}
