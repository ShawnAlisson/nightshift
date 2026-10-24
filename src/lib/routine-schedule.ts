// Shared by server and client: no server-only imports here.

export const CATEGORIES = ["shopping", "bill", "account", "health", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CADENCES = ["once", "weekly", "monthly", "yearly"] as const;
export type Cadence = (typeof CADENCES)[number];

export const CADENCE_LABELS: Record<Cadence, string> = {
  once: "Just once",
  weekly: "Every week",
  monthly: "Every month",
  yearly: "Every year",
};

/** A routine as the browser sees it. */
export type RoutineSummary = {
  id: string;
  title: string;
  instruction: string;
  phrases: string[];
  category: Category;
  cadence: Cadence;
  /** ISO timestamp. Routines are due on a calendar day, stored at noon UTC. */
  dueAt: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CATCH_UP = 400;

/** Adds calendar months in UTC, clamping to the month's last day (Jan 31 + 1 month = Feb 28/29). */
function addMonths(from: Date, months: number) {
  const result = new Date(from);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/** The occurrence after `from`, or null for one-off routines. */
export function nextOccurrence(cadence: Cadence, from: Date): Date | null {
  switch (cadence) {
    case "weekly":
      return new Date(from.getTime() + 7 * DAY_MS);
    case "monthly":
      return addMonths(from, 1);
    case "yearly":
      return addMonths(from, 12);
    case "once":
      return null;
  }
}

/**
 * After a routine is done (or skipped): the next due date strictly in the future,
 * skipping any occurrences that were missed. Null means it is finished.
 */
export function nextDueAfter(cadence: Cadence, dueAt: Date, now: Date): Date | null {
  let next = nextOccurrence(cadence, dueAt);
  for (let i = 0; next && next <= now && i < MAX_CATCH_UP; i++) next = nextOccurrence(cadence, next);
  return next;
}
