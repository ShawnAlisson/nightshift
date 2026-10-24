import "server-only";
import { requireUserId } from "@/lib/dal";
import { Routine } from "@/lib/models/routine";
import { connectDB } from "@/lib/mongodb";
import type { RoutineSummary } from "@/lib/routine-schedule";

const UPCOMING_DAYS = 7;
const UPCOMING_LIMIT = 6;
const LIST_LIMIT = 50;
const CONTEXT_LIMIT = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

type RoutineDoc = {
  _id: { toString(): string };
  title: string;
  instruction: string;
  phrases: string[];
  category: RoutineSummary["category"];
  cadence: RoutineSummary["cadence"];
  nextDueAt: Date;
};

const toSummary = (doc: RoutineDoc): RoutineSummary => ({
  id: doc._id.toString(),
  title: doc.title,
  instruction: doc.instruction,
  phrases: doc.phrases,
  category: doc.category,
  cadence: doc.cadence,
  dueAt: doc.nextDueAt.toISOString(),
});

// Every query is scoped to the signed-in user.

/** Routines due within the next week (or overdue) that are not snoozed: the proactive cards. */
export async function listUpcomingRoutines(): Promise<RoutineSummary[]> {
  const userId = await requireUserId();
  await connectDB();

  const now = new Date();
  const docs = await Routine.find({
    userId,
    active: true,
    nextDueAt: { $lte: new Date(now.getTime() + UPCOMING_DAYS * DAY_MS) },
    $or: [{ snoozedUntil: null }, { snoozedUntil: { $lte: now } }],
  })
    .sort({ nextDueAt: 1 })
    .limit(UPCOMING_LIMIT)
    .lean();

  return docs.map(toSummary);
}

/** All of the user's active routines, soonest first. */
export async function listRoutines(): Promise<RoutineSummary[]> {
  const userId = await requireUserId();
  await connectDB();

  const docs = await Routine.find({ userId, active: true }).sort({ nextDueAt: 1 }).limit(LIST_LIMIT).lean();
  return docs.map(toSummary);
}

/**
 * Tells the assistant about the user's routines, so a phrase like "the usual" turns into the
 * action the user means. Empty when there are none.
 */
export async function getRoutineContext(userId: string): Promise<string> {
  await connectDB();
  const docs = await Routine.find({ userId, active: true }).sort({ nextDueAt: 1 }).limit(CONTEXT_LIMIT).lean();
  if (docs.length === 0) return "";

  const lines = docs.map((doc) => {
    const also = doc.phrases.length ? ` (they may say ${doc.phrases.map((p) => `"${p}"`).join(" or ")})` : "";
    return `- ${doc.title}${also}: ${doc.instruction}`;
  });
  return [
    "The user has saved routines. When they mention one by name, or by their own words (in quotes), do what its instruction says:",
    ...lines,
  ].join("\n");
}
