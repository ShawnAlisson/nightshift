import assert from "node:assert/strict";
import { runScript } from "../src/lib/showcase/runner";
import { buildScript, sampleRoutines } from "../src/lib/showcase/script";
import { LIVE_STEPS } from "../src/lib/showcase/live-steps";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MockDesktop } from "../src/components/showcase/mock-desktop";
import {
  ADD_BUTTON, addButtonSpot, BASKET, basketTotal, CANVAS, CHECKOUT_BUTTON, ORDER_NUMBER, orderTotal, PASSWORD_FIELD,
  PLACE_ORDER_BUTTON, PRODUCTS, REFILL_BUTTON, SEARCH_BOX, SPOTS, spokenOrderNumber, spokenPrice, TILE, tilePosition,
  VIEWPORT, type Rect,
} from "../src/lib/showcase/layout";
import { INITIAL_DESKTOP, type DesktopState } from "../src/lib/showcase/types";
import type { RunnerContext, Step } from "../src/lib/showcase/types";

const FAST = 1_000_000;
const now = new Date("2026-10-24T10:00:00Z");
const script = buildScript(now, "mock");
const liveScript = buildScript(now, "live");

// Nothing the script shows may mention what it is.
const shown = JSON.stringify(script) + JSON.stringify(liveScript) + JSON.stringify(sampleRoutines(now));
assert.doesNotMatch(shown, /demo/i, "no user-visible text mentions a demo");

// A recording stand-in for the screen.
function recorder() {
  const log: string[] = [];
  const assistantChunks: string[] = [];
  const typed: string[] = [];
  const users: string[] = [];
  const spoken: string[] = [];
  const captions: string[] = [];
  const liveCalls: string[] = [];
  const liveViews: boolean[] = [];
  let desktopOpen = false;
  let openedBeforeAssistant = false;
  const ctx: RunnerContext = {
    caption: (text) => (captions.push(text), log.push("caption")),
    clearCaption: () => log.push("clearCaption"),
    voice: (state) => log.push(`voice:${state}`),
    cards: (cards) => log.push(`cards:${cards ? cards.length : "none"}`),
    pressCard: (id) => log.push(`press:${id}`),
    removeCard: (id) => log.push(`remove:${id}`),
    input: (text) => typed.push(text),
    user: (text) => (users.push(text), log.push("user")),
    assistant: (chunk) => assistantChunks.push(chunk),
    activity: () => {},
    replyDone: () => log.push("replyDone"),
    speak: (text) => spoken.push(text),
    live: async (step) => void liveCalls.push(step),
    liveView: (show) => void liveViews.push(show),
    desktop: (patch) => {
      if (patch && !desktopOpen) openedBeforeAssistant = users.length > 0;
      desktopOpen = patch !== null;
      log.push(patch ? "desktop" : "desktopClosed");
    },
    reset: () => log.push("reset"),
    palette: (action, text) => log.push(`palette:${action}${text ? `:${text}` : ""}`),
    save: async () => void log.push("save"),
    finish: () => log.push("finish"),
  };
  return { ctx, log, assistantChunks, typed, users, spoken, captions, liveCalls, liveViews, state: () => ({ desktopOpen, openedBeforeAssistant }) };
}

// 1. The whole run plays through, in order, and ends cleanly.
{
  const r = recorder();
  await runScript(script, r.ctx, new AbortController().signal, FAST);
  assert.equal(r.log[0], "reset", "starts from a clean screen");
  assert.equal(r.log.at(-1), "finish", "ends by finishing");
  assert.equal(r.log.filter((entry) => entry === "finish").length, 1);
  assert.ok(r.state().openedBeforeAssistant, "the desktop only opens after the person has asked for something");
  assert.equal(r.state().desktopOpen, false, "the desktop is closed at the end");

  // What the assistant said, reassembled from streamed chunks, is exactly the script's text.
  const said = script.filter((s): s is Extract<Step, { do: "assistant" }> => s.do === "assistant").map((s) => s.text);
  assert.equal(r.assistantChunks.join(""), said.join(""), "streamed text matches the script");
  assert.deepEqual(r.spoken, said, "every answer is read aloud once");

  // What the person said is typed in live, word by word, then sent whole.
  const asked = script.filter((s): s is Extract<Step, { do: "user" }> => s.do === "user").map((s) => s.text);
  assert.deepEqual(r.users.slice(0, 2), [asked[0], asked[1]]);
  assert.ok(r.typed.includes("Order the") && r.typed.includes("Order the usual"), "words appear one at a time");

  // The search box is driven for real: opened, typed letter by letter, closed.
  const paletteLog = r.log.filter((entry) => entry.startsWith("palette"));
  assert.equal(paletteLog[0], "palette:open");
  assert.equal(paletteLog.at(-1), "palette:close");
  assert.ok(paletteLog.includes("palette:type:g") && paletteLog.includes("palette:type:groceries"));
  assert.ok(r.log.indexOf("save") < r.log.indexOf("palette:open"), "the chat is saved before it is searched for");
}

// 2. The numbers it speaks match what is on the screen.
{
  assert.equal(basketTotal(PRODUCTS.length), 17.5, "items");
  const total = orderTotal(PRODUCTS.length);
  assert.equal(total, 20, "items plus the 2.50 delivery fee");
  assert.equal(spokenPrice(total), "20 pounds");
  assert.equal(spokenPrice(17.5), "17 pounds 50");
  assert.equal(spokenOrderNumber(ORDER_NUMBER), "G M 4 8 2 1 3");
  const answer = script.find((s) => s.do === "assistant" && s.text.includes("usual items")) as Extract<Step, { do: "assistant" }>;
  assert.ok(answer.text.includes(`your ${PRODUCTS.length} usual items`) && answer.text.includes("total is 20 pounds"));
  const confirmed = script.find((s) => s.do === "assistant" && s.text.includes("confirmation number")) as Extract<Step, { do: "assistant" }>;
  assert.ok(confirmed.text.endsWith("G M 4 8 2 1 3."), "the order number is read out digit by digit");
}

// 3. Stopping works at any moment and leaves nothing running.
{
  const r = recorder();
  const controller = new AbortController();
  const run = runScript(script, r.ctx, controller.signal, 20); // slow enough to stop mid-way
  setTimeout(() => controller.abort(), 400);
  await assert.rejects(run, { name: "AbortError" });
  const before = r.log.length;
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(r.log.length, before, "nothing more happens after stopping");
  assert.ok(!r.log.includes("finish"), "a stopped run does not finish");
}

// 4. A run that is already stopped does nothing.
{
  const r = recorder();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(runScript(script, r.ctx, controller.signal, FAST), { name: "AbortError" });
  assert.equal(r.log.length, 0);
}

// 4b. The real-website path: its steps run in a sensible order, and it always puts the browser back.
{
  const r = recorder();
  await runScript(liveScript, r.ctx, new AbortController().signal, FAST);
  assert.deepEqual(r.liveCalls, ["open", "accept-cookies", "enter-address", "pick-address", "grocery", "login", "cleanup"]);
  assert.ok(r.liveCalls.every((step) => (LIVE_STEPS as readonly string[]).includes(step)), "only known steps are requested");
  assert.deepEqual(r.liveViews, [true, false], "the live panel opens before the first step and closes at the end");
  assert.equal(r.log.at(-1), "finish");
  assert.ok(r.users.includes("Yes, go ahead"), "it asks before going to sign-in");
  assert.ok(r.log.includes("user") && r.spoken.some((line) => /never type passwords/.test(line)), "it hands over at the sign-in");
  // The live path never draws the fake desktop.
  assert.ok(!r.log.includes("desktop"), "the real run does not use the drawn desktop");
  const joined = r.assistantChunks.join("");
  assert.doesNotMatch(joined, /confirmation number|order is confirmed/, "it never claims to have placed an order on the real site");
}

// 4c. The drawn path makes no claim to be a real website.
assert.doesNotMatch(JSON.stringify(script), /real website|real Uber/i, "the drawn scene is not presented as a real site");
assert.ok(!recorder().liveCalls.length);

// 5. The cursor lands on what it is meant to press. Spots are canvas coordinates; rects are page coordinates.
{
  const inside = (spot: { x: number; y: number }, rect: Rect, label: string, origin = { x: 0, y: 0 }) => {
    const x = spot.x - VIEWPORT.left - origin.x;
    const y = spot.y - VIEWPORT.top - origin.y;
    assert.ok(
      x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height,
      `${label}: cursor (${x}, ${y}) is outside the button ${JSON.stringify(rect)}`,
    );
  };
  PRODUCTS.forEach((product, index) => inside(addButtonSpot(index), ADD_BUTTON, `Add ${product.name}`, tilePosition(index)));
  inside(SPOTS.search, SEARCH_BOX, "search");
  inside(SPOTS.checkout, CHECKOUT_BUTTON, "checkout", BASKET);
  inside(SPOTS.password, PASSWORD_FIELD, "password");
  inside(SPOTS.placeOrder, PLACE_ORDER_BUTTON, "place order");
  inside(SPOTS.requestRefill, REFILL_BUTTON, "refill");

  // Everything fits on the page, and the product grid never runs under the basket.
  const lastTile = tilePosition(PRODUCTS.length - 1);
  assert.ok(tilePosition(TILE.columns - 1).x + TILE.width < BASKET.x, "tiles stop before the basket");
  assert.ok(lastTile.y + TILE.height < VIEWPORT.height && BASKET.y + BASKET.height < VIEWPORT.height, "nothing is cut off");
  for (const spot of Object.values(SPOTS)) {
    assert.ok(spot.x >= 0 && spot.x <= CANVAS.width && spot.y >= 0 && spot.y <= CANVAS.height, "cursor stays on screen");
  }
}

// 6. Each drawn page shows what the script says is happening.
{
  const draw = (changes: Partial<DesktopState>) => renderToStaticMarkup(createElement(MockDesktop, { state: { ...INITIAL_DESKTOP, ...changes } }));
  const store = draw({ page: "store", basket: 3, search: "weekly shop" });
  assert.equal(store.match(/1 in basket/g)?.length, 3, "three items are shown as added");
  assert.ok(store.includes("weekly shop") && store.includes("£5.05") && store.includes("£7.55"), "search text, subtotal and total with delivery");
  const full = draw({ page: "store", basket: PRODUCTS.length });
  assert.ok(full.includes("£17.50") && full.includes("£20.00"), "full basket total matches what is spoken");
  assert.ok(draw({ page: "checkout" }).includes("£20.00"), "checkout charges the same total");
  assert.ok(draw({ page: "confirmation" }).includes(ORDER_NUMBER), "the confirmation shows the order number that is read out");
  assert.ok(draw({ page: "checkout", password: 4 }).includes("••••"), "typed password shows as dots");
  assert.ok(draw({ page: "checkout", handover: true }).includes("Your turn"), "the handover is visible");
  assert.ok(!draw({ page: "checkout" }).includes("Your turn"), "and only during the handover");
  assert.ok(draw({ page: "confirmation" }).includes("your order is confirmed"));
  assert.ok(draw({ page: "pharmacy", refillRequested: true }).includes("Requested ✓"));
  assert.ok(draw({ cursor: { x: 321, y: 123 } }).includes("left:321px;top:123px"), "the cursor is where it was told");
  assert.doesNotMatch(draw({ page: "store" }), /demo/i, "nothing drawn mentions a demo");
}

console.log("showcase: all checks passed");
