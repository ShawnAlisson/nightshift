import { InferSchemaType, Model, Schema, model, models } from "mongoose";
import { CADENCES, CATEGORIES } from "@/lib/routine-schedule";

const routineSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    // What the assistant is told to do when the routine runs.
    instruction: { type: String, required: true, trim: true, maxlength: 500 },
    // How this person talks about it, e.g. "the usual". Lets the assistant map their words to the action.
    phrases: { type: [{ type: String, trim: true, maxlength: 40 }], default: [] },
    category: { type: String, enum: CATEGORIES, default: "other" },
    cadence: { type: String, enum: CADENCES, default: "once" },
    nextDueAt: { type: Date, required: true },
    // Hides the card until this time ("Later").
    snoozedUntil: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Serves the cards query: a user's active routines, soonest first.
routineSchema.index({ userId: 1, active: 1, nextDueAt: 1 });

export type IRoutine = InferSchemaType<typeof routineSchema>;

export const Routine: Model<IRoutine> = models.Routine || model<IRoutine>("Routine", routineSchema);
