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
  { xdotool: ["mousemove", "500", "300", "sleep", "0.05", "click", "1"] },
]);
assert.deepEqual(args("left_click", { coordinate: [5, 6], text: "ctrl+shift" }), [
  { xdotool: ["keydown", "ctrl", "keydown", "shift", "mousemove", "5", "6", "sleep", "0.05", "click", "1", "keyup", "ctrl", "keyup", "shift"] },
]);
assert.deepEqual(args("double_click", { coordinate: [1, 2] }), [
  { xdotool: ["mousemove", "1", "2", "sleep", "0.05", "click", "--repeat", "2", "--delay", "80", "1"] },
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

// --- Routine scheduling ---
import { nextDueAfter, nextOccurrence } from "../src/lib/routine-schedule";
import { parsePhrases } from "../src/lib/validations/routines";

const d = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;
assert.equal(iso(nextOccurrence("weekly", d("2026-10-24"))), "2026-10-31");
assert.equal(iso(nextOccurrence("monthly", d("2026-01-31"))), "2026-02-28", "month-end is clamped");
assert.equal(iso(nextOccurrence("monthly", d("2028-01-31"))), "2028-02-29", "leap year");
assert.equal(iso(nextOccurrence("yearly", d("2028-02-29"))), "2029-02-28");
assert.equal(nextOccurrence("once", d("2026-10-24")), null);
// Done on time: just the next one. Done very late: skip the ones already missed.
assert.equal(iso(nextDueAfter("weekly", d("2026-10-24"), d("2026-10-24"))), "2026-10-31");
assert.equal(iso(nextDueAfter("weekly", d("2026-10-03"), d("2026-10-24"))), "2026-10-31");
assert.equal(nextDueAfter("once", d("2026-10-24"), d("2026-10-24")), null);
assert.deepEqual(parsePhrases(" the usual, my weekly shop ,, the usual "), ["the usual", "my weekly shop"]);
assert.equal(parsePhrases("a,b,c,d,e,f,g").length, 5);
console.log("routine scheduling: all checks passed");

// --- Spoken replies ---
import { toSpeakable } from "../src/hooks/use-speech-synthesis";

assert.deepEqual(toSpeakable("**Done!** Your order is placed."), ["Done! Your order is placed."]);
assert.deepEqual(toSpeakable("First line.\n\nSecond line."), ["First line. Second line."]);
assert.deepEqual(toSpeakable("Milk\nBread"), ["Milk. Bread"], "a line break without punctuation becomes a pause");
assert.deepEqual(toSpeakable("   "), []);
const long = "This is a sentence. ".repeat(30);
const chunks = toSpeakable(long);
assert.ok(chunks.length > 1 && chunks.every((c) => c.length <= 200), "long text is split into short chunks");
assert.equal(chunks.join(" ").replace(/\s+/g, " "), long.trim().replace(/\s+/g, " "), "nothing is lost");
console.log("spoken replies: all checks passed");

// --- Friendly provider errors ---
import { assistantErrorMessage } from "../src/lib/assistant-errors";

const withStatus = (status: number, message = "x") => Object.assign(new Error(message), { status });
assert.match(assistantErrorMessage(withStatus(402)), /enough credit/);
assert.match(assistantErrorMessage(withStatus(429)), /busy/);
assert.match(assistantErrorMessage(withStatus(401)), /sign in/);
assert.match(assistantErrorMessage(withStatus(400, '400 {"error":{"code":"starter_credit_tools"}}')), /starter credit/);
assert.match(assistantErrorMessage(new Error("boom")), /couldn't respond/);
assert.match(assistantErrorMessage("not an error object"), /couldn't respond/);
// Provider wording never reaches the user.
assert.doesNotMatch(assistantErrorMessage(withStatus(402, "openrouter.ai/settings/credits key c00c5971")), /openrouter|c00c5971/);
console.log("friendly errors: all checks passed");

// --- Regression: `mousemove --sync` hangs forever when the pointer is already at the target ---
for (const [name, input] of [
  ["left_click", { coordinate: [300, 300] }],
  ["double_click", { coordinate: [300, 300] }],
  ["mouse_move", { coordinate: [300, 300] }],
  ["left_click_drag", { start_coordinate: [1, 1], coordinate: [300, 300] }],
  ["scroll", { coordinate: [300, 300], scroll_direction: "down", scroll_amount: 3 }],
] as const) {
  const plan = planAction(block(name, input));
  assert.equal(plan.kind, "steps");
  if (plan.kind === "steps") {
    for (const step of plan.steps) {
      if ("xdotool" in step) assert.ok(!step.xdotool.includes("--sync"), `${name} must not use --sync`);
    }
  }
}
console.log("no --sync: all checks passed");
