import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
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

/** Shared by every OpenAI-compatible endpoint (OpenAI itself and OpenRouter). */
async function* streamOpenAICompatible(
  provider: "openai" | "openrouter",
  messages: ChatMessage[],
  signal: AbortSignal,
) {
  const client = new OpenAI({ baseURL: BASE_URLS[provider], apiKey: getApiKey() });
  const stream = await client.chat.completions.create(
    {
      model: MODELS[provider],
      stream: true,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    },
    { signal },
  );
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

const streamers: Record<Provider, Streamer> = {
  async *anthropic(messages, signal) {
    const client = new Anthropic({ baseURL: BASE_URLS.anthropic, apiKey: getApiKey() });
    const stream = client.messages.stream(
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
    const client = new GoogleGenAI({
      apiKey: getApiKey(),
      httpOptions: { baseUrl: BASE_URLS.gemini },
    });
    const stream = await client.models.generateContentStream({
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

function getProvider(): Provider {
  const configured = process.env.MUBIT_PROVIDER ?? "anthropic";
  if (!(PROVIDERS as readonly string[]).includes(configured)) {
    throw new Error(`MUBIT_PROVIDER must be one of: ${PROVIDERS.join(", ")}`);
  }
  return configured as Provider;
}

/** Streams the assistant's reply as text chunks from the configured provider, via Mubit. */
export function streamChat(messages: ChatMessage[], signal: AbortSignal) {
  return streamers[getProvider()](messages, signal);
}
