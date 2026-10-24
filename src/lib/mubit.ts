import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Mubit is an Anthropic-compatible gateway: same SDK, different base URL (no /v1).
const MUBIT_BASE_URL = "https://api.mubit.ai/anthropic";

export const ASSISTANT_MODEL = process.env.MUBIT_MODEL ?? "claude-haiku-4-5";

let client: Anthropic | undefined;

export function getMubitClient() {
  const apiKey = process.env.MUBIT_API_KEY;
  if (!apiKey) {
    throw new Error("MUBIT_API_KEY is not set in .env.local");
  }
  return (client ??= new Anthropic({ baseURL: MUBIT_BASE_URL, apiKey }));
}
