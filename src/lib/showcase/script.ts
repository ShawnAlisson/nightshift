import type { RoutineSummary } from "@/lib/routine-schedule";
import {
  addButtonSpot,
  ORDER_NUMBER,
  orderTotal,
  PRODUCTS,
  SPOTS,
  spokenOrderNumber,
  spokenPrice,
} from "@/lib/showcase/layout";
import type { DesktopState, Step } from "@/lib/showcase/types";

/** A calendar day `days` from today, stored the way real routines are (noon UTC). */
function dueIn(now: Date, days: number) {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + days, 12)).toISOString();
}

export function sampleRoutines(now: Date): RoutineSummary[] {
  return [
    {
      id: "groceries",
      title: "Weekly groceries",
      instruction: "Order my usual weekly groceries. Stop at checkout and ask me to approve before paying.",
      phrases: ["the usual", "my weekly shop"],
      category: "shopping",
      cadence: "weekly",
      dueAt: dueIn(now, 0),
    },
    {
      id: "prescription",
      title: "Prescription refill",
      instruction: "Request a refill of my repeat prescription and tell me when it will be ready.",
      phrases: ["my medication"],
      category: "health",
      cadence: "monthly",
      dueAt: dueIn(now, 2),
    },
    {
      id: "electricity",
      title: "Electricity bill",
      instruction: "Open my electricity account and read me this month's bill. Ask me before paying anything.",
      phrases: ["the electric bill"],
      category: "bill",
      cadence: "monthly",
      dueAt: dueIn(now, 4),
    },
  ];
}

export type ShowcaseMode = "live" | "mock";

/** 1. It opens ready to listen, with reminders waiting. */
export function buildIntro(now: Date): Step[] {
  return [
    { do: "reset" },
    { do: "voice", state: "listening" },
    { do: "cards", cards: sampleRoutines(now) },
    { do: "caption", text: "It opens already listening, with your reminders ready.", tags: ["Voice first", "Reminders"] },
    { do: "wait", ms: 4200 },
  ];
}

/**
 * 2 and 3, on the real thing: the real Uber Eats, driven live on the real desktop. It stops at the
 * real sign-in screen, because a password is never the assistant's to type.
 */
export function buildLiveScene(): Step[] {
  return [
    { do: "caption", text: "Say it your way. “The usual” is a phrase you saved.", tags: ["Personal phrasing"] },
    { do: "user", text: "Order the usual" },
    { do: "cards", cards: null },
    { do: "assistant", text: "Got it. That's your weekly groceries on Uber Eats. Opening it now." },
    { do: "caption", text: "This is the real Uber Eats, running live on its own private desktop.", tags: ["Live desktop", "Real website"] },
    { do: "liveView", show: true },
    { do: "live", step: "open", label: "Opening Uber Eats" },
    { do: "live", step: "accept-cookies", label: "Clearing the cookie notice" },
    { do: "live", step: "enter-address", label: "Typing your delivery address" },
    { do: "live", step: "pick-address", label: "Choosing your address" },
    { do: "live", step: "grocery", label: "Opening Grocery" },
    { do: "caption", text: "Before it goes further, it asks. You always decide.", tags: ["You approve"] },
    { do: "assistant", text: "These are the grocery stores that deliver to you. Shall I start your order? Say yes to approve." },
    { do: "user", text: "Yes, go ahead" },
    { do: "live", step: "login", label: "Opening sign in" },
    { do: "caption", text: "Passwords stay with you. It stops here and hands over.", tags: ["Take over"] },
    {
      do: "assistant",
      text: "Uber Eats needs you signed in. I never type passwords or codes, so it's your turn. Sign in on the desktop and I'll carry on.",
    },
    { do: "wait", ms: 4500 },
    { do: "live", step: "cleanup", label: "Tidying up" },
    { do: "liveView", show: false },
  ];
}

/**
 * 2 and 3, drawn: used when the live desktop can't start, so the walkthrough never fails.
 * Four everyday jobs for someone who can't easily use their hands: the weekly shop (said their own
 * way, approved before paying, with a password handover) and a one-tap prescription refill.
 */
export function buildDrawnScene(now: Date): Step[] {
  const routines = sampleRoutines(now);
  const prescription = routines[1];
  const itemCount = PRODUCTS.length;
  const total = orderTotal(itemCount);
  let clicks = 0;

  /** Move the cursor to a spot, then click there. */
  const tap = (label: string, spot: { x: number; y: number }, after: Partial<DesktopState> = {}): Step[] => [
    { do: "act", label, patch: { cursor: spot }, ms: 520 },
    { do: "act", label, patch: { clicks: ++clicks, ...after }, ms: 380 },
  ];

  return [
    // The weekly shop, in the person's own words.
    { do: "caption", text: "Say it your way. “The usual” is a phrase you saved.", tags: ["Personal phrasing"] },
    { do: "user", text: "Order the usual" },
    { do: "cards", cards: null },
    { do: "assistant", text: "Got it. That's your weekly groceries. I'll order them now." },
    { do: "caption", text: "It does the shopping on its own private desktop.", tags: ["Private desktop"] },
    { do: "act", label: "Starting the desktop", patch: { page: "blank" }, ms: 1500 },
    { do: "act", label: "Looking at the screen", ms: 900 },
    { do: "act", label: "Opening the supermarket", patch: { page: "store", cursor: SPOTS.idle }, ms: 1200 },
    ...tap("Clicking", SPOTS.search),
    { do: "act", label: "Typing", patch: { search: "weekly shop" }, ms: 1000 },
    ...PRODUCTS.flatMap((_, index) => tap("Adding to the basket", addButtonSpot(index), { basket: index + 1 })),
    { do: "caption", text: "Before it pays, it asks. You always decide.", tags: ["You approve"] },
    {
      do: "assistant",
      text: `Your basket has your ${itemCount} usual items. With delivery the total is ${spokenPrice(total)}. Shall I check out? Say yes to approve.`,
    },
    { do: "user", text: "Yes, go ahead" },
    ...tap("Clicking", SPOTS.checkout, { page: "checkout" }),
    { do: "caption", text: "Passwords stay with you. You take over, then hand it back.", tags: ["Take over"] },
    {
      do: "assistant",
      text: "Checkout needs your password. I never type passwords, so it's your turn. Enter it on the desktop and I'll carry on.",
    },
    { do: "desktop", patch: { handover: true, cursor: SPOTS.password } },
    ...Array.from({ length: 9 }, (_, index): Step => ({ do: "act", label: "Waiting for you", patch: { password: index + 1 }, ms: 260 })),
    { do: "desktop", patch: { handover: false } },
    { do: "user", text: "Done, I'm signed in" },
    { do: "assistant", text: "Thanks. Placing the order now." },
    ...tap("Clicking", SPOTS.placeOrder, { page: "confirmation" }),
    {
      do: "assistant",
      text: `All done. Your order is confirmed for delivery tomorrow between 9 and 11. The confirmation number is ${spokenOrderNumber(ORDER_NUMBER)}.`,
    },

    // A reminder, done with one tap.
    { do: "desktop", patch: null },
    { do: "reset" },
    { do: "cards", cards: routines.slice(1) },
    { do: "voice", state: "listening" },
    { do: "caption", text: "Reminders turn into one tap. No searching, no forms.", tags: ["One tap", "Reminders"] },
    { do: "wait", ms: 2200 },
    { do: "tapCard", id: prescription.id },
    { do: "cards", cards: null },
    { do: "send", text: prescription.instruction },
    { do: "assistant", text: "On it. I'm requesting your refill now." },
    { do: "act", label: "Starting the desktop", patch: { page: "blank", cursor: SPOTS.idle }, ms: 1200 },
    { do: "act", label: "Opening your pharmacy", patch: { page: "pharmacy" }, ms: 1200 },
    ...tap("Clicking", SPOTS.requestRefill, { refillRequested: true }),
    { do: "assistant", text: "Done. Your refill will be ready to collect on Thursday after noon." },
    { do: "desktop", patch: null },
  ];
}

/** 4. Everything is saved and easy to find again. */
export function buildOutro(): Step[] {
  return [
    { do: "caption", text: "Every chat is saved. Search, rename or delete them any time.", tags: ["Saved chats", "Search"] },
    { do: "save" },
    { do: "palette", query: "groceries" },
    { do: "clearCaption" },
    { do: "finish" },
  ];
}

/** The whole run in one list, for the chosen middle scene. */
export function buildScript(now: Date, mode: ShowcaseMode = "live"): Step[] {
  return [...buildIntro(now), ...(mode === "live" ? buildLiveScene() : buildDrawnScene(now)), ...buildOutro()];
}
