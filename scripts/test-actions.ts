import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { ActionError, planAction } from "../src/lib/computer/actions";

const block = (name: string, input: object) =>
  ({ type: "tool_use", id: "t", name, input, toolset_name: "computer" }) as unknown as Anthropic.ComputerToolUseBlock;
const args = (name: string, input: object) => {
  const plan = planAction(block(name, input));
  assert.equal(plan.kind, "steps");
  return plan.kind === "steps" ? plan.steps : [];
};

assert.deepEqual(args("left_click", { coordinate: [500, 300] }), [
  { xdotool: ["mousemove", "--sync", "500", "300", "click", "1"] },
]);
assert.deepEqual(args("left_click", { coordinate: [5, 6], text: "ctrl+shift" }), [
  { xdotool: ["keydown", "ctrl", "keydown", "shift", "mousemove", "--sync", "5", "6", "click", "1", "keyup", "ctrl", "keyup", "shift"] },
]);
assert.deepEqual(args("double_click", { coordinate: [1, 2] }), [
  { xdotool: ["mousemove", "--sync", "1", "2", "click", "--repeat", "2", "--delay", "80", "1"] },
]);
assert.deepEqual(args("scroll", { scroll_direction: "down", scroll_amount: 999 }), [
  { xdotool: ["click", "--repeat", "30", "--delay", "30", "5"] },
]);
// Text is passed as a single argument after "--", so shell metacharacters are inert.
assert.deepEqual(args("type", { text: "$(rm -rf /); `id` -x" }), [
  { xdotool: ["type", "--delay", "10", "--", "$(rm -rf /); `id` -x"] },
]);
assert.deepEqual(args("key", { text: "ctrl+s" }), [
  { xdotool: ["key", "--repeat", "1", "--delay", "60", "--", "ctrl+s"] },
]);
assert.deepEqual(args("wait", { duration: 9999 }), [{ sleepMs: 30000 }]);
assert.equal(planAction(block("screenshot", {})).kind, "screenshot");

for (const [name, input] of [
  ["left_click", { coordinate: [1280, 10] }], // off-screen
  ["left_click", { coordinate: [-1, 10] }],
  ["left_click", { coordinate: [1.5, 10] }],
  ["left_click", { coordinate: [1, 2, 3] }],
  ["left_click", { coordinate: [1, 2], text: "meta; rm" }],
  ["key", { text: "ctrl+s; reboot" }],
  ["key", { text: "--help" }],
  ["type", { text: "x".repeat(4001) }],
  ["scroll", { scroll_direction: "sideways", scroll_amount: 1 }],
  ["zoom", { region: [0, 0, 1, 1] }],
] as const) {
  assert.throws(() => planAction(block(name, input)), ActionError, `${name} ${JSON.stringify(input)}`);
}
console.log("actions: all checks passed");

// --- Gemini translation ---
import { fromGeminiCall } from "../src/lib/computer/gemini-actions";

const gemini = (name: string, args: Record<string, unknown>) => fromGeminiCall(name, args);
// 0-999 normalized -> 1280x800 pixels
assert.deepEqual(gemini("click", { x: 500, y: 500 }), [{ name: "left_click", input: { coordinate: [640, 400] } }]);
assert.deepEqual(gemini("click", { x: 999, y: 999 }), [{ name: "left_click", input: { coordinate: [1279, 799] } }]);
assert.deepEqual(gemini("type", { text: "hi", press_enter: true }), [
  { name: "type", input: { text: "hi" } },
  { name: "key", input: { text: "Return" } },
]);
assert.deepEqual(gemini("hotkey", { keys: ["Control", "S"] }), [{ name: "key", input: { text: "ctrl+S" } }]);
assert.deepEqual(gemini("press_key", { key: "ArrowDown" }), [{ name: "key", input: { text: "Down" } }]);
assert.deepEqual(gemini("scroll", { x: 100, y: 100, direction: "down", magnitude_in_pixels: 300 }), [
  { name: "scroll", input: { coordinate: [128, 80], scroll_direction: "down", scroll_amount: 3 } },
]);
assert.equal(gemini("navigate", { url: "https://example.com" }).length, 3);
assert.throws(() => gemini("navigate", { url: "javascript:alert(1)" }), ActionError);
assert.throws(() => gemini("click", { x: "abc", y: 1 }), ActionError);
assert.throws(() => gemini("open_app", { app_name: "x" }), ActionError);
// Translated actions still go through the same validation as Claude's.
for (const action of [...gemini("hotkey", { keys: ["Control", "S"] }), ...gemini("drag_and_drop", { start_x: 1, start_y: 2, end_x: 3, end_y: 4 })]) {
  assert.doesNotThrow(() => planAction(action));
}
assert.throws(() => planAction(gemini("press_key", { key: "ctrl; reboot" })[0]), ActionError);
console.log("gemini actions: all checks passed");

// --- Function-calling adapter helpers ---
import { mergeToolCallDeltas, parseArguments, type PartialToolCall } from "../src/lib/computer/tool-calls";

const calls: PartialToolCall[] = [];
mergeToolCallDeltas(calls, [{ index: 0, id: "call_1", function: { name: "computer", arguments: '{"action":"le' } }]);
mergeToolCallDeltas(calls, [{ index: 0, function: { name: "computer", arguments: 'ft_click","coordinate":[5,6]}' } }]);
mergeToolCallDeltas(calls, [{ index: 1, id: "call_2", function: { name: "computer", arguments: "{}" }, extra_content: { sig: "x" } }]);
assert.equal(calls.length, 2);
assert.equal(calls[0].name, "computer"); // repeated names are not doubled
assert.deepEqual(parseArguments(calls[0].arguments), { action: "left_click", coordinate: [5, 6] });
assert.deepEqual(calls[1].extra, { sig: "x" });
assert.deepEqual(parseArguments(""), {});
for (const bad of ['{"action":', "[1]", "null", '"str"']) assert.throws(() => parseArguments(bad), ActionError, bad);
console.log("tool-call helpers: all checks passed");
