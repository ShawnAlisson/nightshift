"use server";

import { requireUserId } from "@/lib/dal";
import { Routine } from "@/lib/models/routine";
import { connectDB } from "@/lib/mongodb";
import { nextDueAfter, type RoutineSummary } from "@/lib/routine-schedule";
import { listRoutines, listUpcomingRoutines } from "@/lib/routines";
import {
  dueDateToDate,
  objectIdSchema,
  parsePhrases,
  routineInputSchema,
} from "@/lib/validations/routines";

// Server actions are public endpoints: every argument is validated and every query is user-scoped.

const DAY_MS = 24 * 60 * 60 * 1000;

export type RoutineFormState = { ok?: boolean; errors?: Record<string, string[] | undefined> } | undefined;

export async function fetchUpcomingRoutines(): Promise<RoutineSummary[]> {
  return listUpcomingRoutines();
}

export async function fetchRoutines(): Promise<RoutineSummary[]> {
  return listRoutines();
}

export async function createRoutine(_: RoutineFormState, formData: FormData): Promise<RoutineFormState> {
  const userId = await requireUserId();
  const field = (name: string) => (typeof formData.get(name) === "string" ? (formData.get(name) as string) : "");

  const parsed = routineInputSchema.safeParse({
    title: field("title"),
    instruction: field("instruction"),
    phrases: field("phrases"),
    category: field("category"),
    cadence: field("cadence"),
    dueDate: field("dueDate"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const { title, instruction, phrases, category, cadence, dueDate } = parsed.data;
  await connectDB();
  await Routine.create({
    userId,
    title,
    instruction,
    phrases: parsePhrases(phrases),
    category,
    cadence,
    nextDueAt: dueDateToDate(dueDate),
  });
  return { ok: true };
}

export async function deleteRoutine(id: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false };

  await connectDB();
  const result = await Routine.deleteOne({ _id: parsedId.data, userId });
  return { ok: result.deletedCount === 1 };
}

/** Hides a card until tomorrow. */
export async function snoozeRoutine(id: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false };

  await connectDB();
  const result = await Routine.updateOne(
    { _id: parsedId.data, userId, active: true },
    { snoozedUntil: new Date(Date.now() + DAY_MS) },
  );
  return { ok: result.matchedCount === 1 };
}

/** Marks a routine done or skipped: recurring ones move to their next date, one-offs finish. */
export async function completeRoutine(id: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false };

  await connectDB();
  const routine = await Routine.findOne({ _id: parsedId.data, userId, active: true });
  if (!routine) return { ok: false };

  const next = nextDueAfter(routine.cadence, routine.nextDueAt, new Date());
  if (next) {
    routine.nextDueAt = next;
    routine.snoozedUntil = undefined;
  } else {
    routine.active = false;
  }
  await routine.save();
  return { ok: true };
}

/** Adds a few realistic routines, but only for someone who has none yet. */
export async function addExampleRoutines(): Promise<{ added: number }> {
  const userId = await requireUserId();
  await connectDB();
  if (await Routine.exists({ userId, active: true })) return { added: 0 };

  const inDays = (days: number) => {
    const day = new Date(Date.now() + days * DAY_MS);
    return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 12));
  };
  const examples = [
    {
      title: "Weekly groceries",
      instruction: "Order my usual weekly groceries from my supermarket account. Stop at checkout and ask me to approve before paying.",
      phrases: ["the usual", "my weekly shop"],
      category: "shopping",
      cadence: "weekly",
      nextDueAt: inDays(0),
    },
    {
      title: "Prescription refill",
      instruction: "Request a refill of my repeat prescription on my pharmacy account and tell me when it will be ready.",
      phrases: ["my medication"],
      category: "health",
      cadence: "monthly",
      nextDueAt: inDays(2),
    },
    {
      title: "Electricity bill",
      instruction: "Open my electricity account and read me this month's bill. Ask me before paying anything.",
      phrases: ["the electric bill"],
      category: "bill",
      cadence: "monthly",
      nextDueAt: inDays(4),
    },
    {
      title: "Streaming subscription",
      instruction: "Check when my streaming subscription renews and what it costs, and tell me.",
      phrases: [],
      category: "account",
      cadence: "monthly",
      nextDueAt: inDays(1),
    },
  ];
  await Routine.insertMany(examples.map((example) => ({ ...example, userId })));
  return { added: examples.length };
}
