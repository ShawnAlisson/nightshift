// Runs the function-calling agent against a fake model and a fake desktop (no network).
// Needs the react-server condition so the "server-only" imports load outside Next.
import assert from "node:assert/strict";
import type OpenAI from "openai";
import type { AssistantEvent } from "../src/lib/assistant-events";
import type { DesktopLease } from "../src/lib/computer/desktop";
import { runOpenAIAgent } from "../src/lib/computer/openai-agent";

const chunk = (delta: object) => ({ choices: [{ delta }] });
const turns = [
  // Turn 1: some text, then a click split across chunks, with provider extras attached.
  [
    chunk({ content: "Opening it" }),
    chunk({ tool_calls: [{ index: 0, id: "call_1", function: { name: "computer", arguments: '{"action":"left_c' } }] }),
    chunk({ tool_calls: [{ index: 0, function: { arguments: 'lick","coordinate":[640,400]}' }, extra_content: { sig: "s1" } }] }),
    chunk({ reasoning_details: [{ type: "reasoning.encrypted", data: "r1" }] }),
  ],
  // Turn 2: the model is done.
  [chunk({ content: "All done." })],
];

const requests: OpenAI.ChatCompletionMessageParam[][] = [];
let turn = 0;
const client = {
  chat: {
    completions: {
      create: async (params: { messages: OpenAI.ChatCompletionMessageParam[]; max_tokens?: number }) => {
        requests.push(structuredClone(params.messages));
        assert.equal(params.max_tokens, 2048, "OpenRouter needs max_tokens");
        const chunks = turns[turn++];
        return (async function* () {
          yield* chunks;
        })();
      },
    },
  },
} as unknown as OpenAI;

const performed: string[] = [];
const desktops = {
  acquire: async () => ({
    created: performed.length === 0,
    desktop: {
      viewUrl: "https://view.example",
      perform: async (action: { name: string }) => {
        performed.push(action.name);
        return action.name === "screenshot" ? { image: "AAAA" } : { text: "OK" };
      },
    },
  }),
} as unknown as DesktopLease;

const events: AssistantEvent[] = [];
for await (const event of runOpenAIAgent(client, "openrouter", [{ role: "user", content: "open it" }], desktops, new AbortController().signal, "You are a test.")) {
  events.push(event);
}

assert.deepEqual(performed, ["left_click", "screenshot"]);
assert.deepEqual(events.map((e) => e.type), ["text", "desktop", "action", "action", "text"]);
assert.equal((events[3] as { label: string }).label, "Thinking", "the wait for the model is labelled");
assert.equal((events[4] as { text: string }).text, "\n\nAll done.", "turns are separated");
assert.equal(turn, 2);

// The second request must carry the assistant turn, its tool result, then the screenshot.
const second = requests[1];
const assistant = second.find((m) => m.role === "assistant") as unknown as Record<string, unknown>;
assert.equal(assistant.content, "Opening it");
const [call] = assistant.tool_calls as { id: string; function: { arguments: string }; extra_content: unknown }[];
assert.equal(call.id, "call_1");
assert.deepEqual(JSON.parse(call.function.arguments), { action: "left_click", coordinate: [640, 400] });
assert.deepEqual(call.extra_content, { sig: "s1" }, "extras are echoed back");
assert.deepEqual(assistant.reasoning_details, [{ type: "reasoning.encrypted", data: "r1" }]);
const roles = second.map((m) => m.role);
assert.deepEqual(roles, ["system", "user", "assistant", "tool", "user"]);
const shot = second[4].content as { type: string }[];
assert.ok(shot.some((part) => part.type === "image_url"), "screenshot is attached");

console.log("openai agent: all checks passed");
