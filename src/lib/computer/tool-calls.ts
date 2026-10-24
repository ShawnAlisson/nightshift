import { ActionError } from "@/lib/computer/actions";

export type PartialToolCall = {
  id: string;
  name: string;
  arguments: string;
  /** Provider-specific data (such as thought signatures) that must be sent back unchanged. */
  extra?: unknown;
};

type ToolCallDelta = {
  index: number;
  id?: string | null;
  function?: { name?: string | null; arguments?: string | null };
  extra_content?: unknown;
};

/** Folds one streamed chunk of tool-call fragments into the calls collected so far. */
export function mergeToolCallDeltas(calls: PartialToolCall[], deltas: readonly ToolCallDelta[]) {
  for (const delta of deltas) {
    const call = (calls[delta.index] ??= { id: "", name: "", arguments: "" });
    if (delta.id) call.id = delta.id;
    // Names arrive whole (some providers repeat them), but arguments arrive in pieces.
    if (delta.function?.name) call.name = delta.function.name;
    if (delta.function?.arguments) call.arguments += delta.function.arguments;
    if (delta.extra_content !== undefined) call.extra = delta.extra_content;
  }
}

/** Parses a tool call's JSON arguments. Models sometimes send bad or truncated JSON. */
export function parseArguments(json: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = json.trim() ? JSON.parse(json) : {};
  } catch {
    throw new ActionError("The action arguments were not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ActionError("The action arguments must be an object");
  }
  return parsed as Record<string, unknown>;
}
