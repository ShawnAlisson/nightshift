import { z } from "zod";
import { CADENCES, CATEGORIES } from "@/lib/routine-schedule";

export const MAX_PHRASES = 5;
export const MAX_PHRASE_LENGTH = 40;

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const isRealDate = (value: string) => !Number.isNaN(Date.parse(`${value}T12:00:00Z`));

export const routineInputSchema = z.object({
  title: z.string().trim().min(1, "Give it a name").max(80, "Keep the name under 80 characters"),
  instruction: z.string().trim().min(1, "Tell me what to do").max(500, "Keep this under 500 characters"),
  // Comma-separated in the form; split in `parsePhrases`.
  phrases: z.string().trim().max(250, "That's too long"),
  category: z.enum(CATEGORIES),
  cadence: z.enum(CADENCES),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date").refine(isRealDate, "Pick a real date"),
});

/** "the usual, my weekly shop" -> ["the usual", "my weekly shop"]. Trimmed, unique, limited. */
export function parsePhrases(raw: string) {
  const phrases = raw.split(",").map((phrase) => phrase.trim().slice(0, MAX_PHRASE_LENGTH)).filter(Boolean);
  return [...new Set(phrases)].slice(0, MAX_PHRASES);
}

/** A due date is a calendar day; storing noon UTC keeps it on that day in every timezone. */
export const dueDateToDate = (dueDate: string) => new Date(`${dueDate}T12:00:00Z`);
