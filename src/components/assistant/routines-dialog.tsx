"use client";

import { Loader2, Mic, Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { createRoutine, deleteRoutine, fetchRoutines, type RoutineFormState } from "@/actions/routines";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { CADENCE_LABELS, CADENCES, CATEGORIES, type RoutineSummary } from "@/lib/routine-schedule";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Local calendar day as the value a date input expects. */
function inputDate(daysFromToday: number) {
  const day = new Date();
  day.setDate(day.getDate() + daysFromToday);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

type RoutinesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after routines are added or removed, so the cards can refresh. */
  onChange: () => void;
};

export function RoutinesDialog({ open, onOpenChange, onChange }: RoutinesDialogProps) {
  const [routines, setRoutines] = useState<RoutineSummary[]>();
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<string>();

  useEffect(() => {
    if (!open) return;
    let stale = false;
    fetchRoutines().then((list) => !stale && setRoutines(list));
    return () => {
      stale = true;
    };
  }, [open]);

  async function remove(id: string) {
    const { ok } = await deleteRoutine(id);
    if (!ok) return;
    setConfirming(undefined);
    setRoutines((current) => current?.filter((routine) => routine.id !== id));
    onChange();
  }

  async function created() {
    setAdding(false);
    setRoutines(await fetchRoutines());
    onChange();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Your routines</DialogTitle>
          <DialogDescription>
            Things you do again and again. I&apos;ll remind you when they&apos;re due, and I&apos;ll understand how you
            talk about them.
          </DialogDescription>
        </DialogHeader>

        {adding ? (
          <NewRoutineForm onCreated={created} onCancel={() => setAdding(false)} />
        ) : (
          <>
            {routines === undefined ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </p>
            ) : routines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No routines yet.</p>
            ) : (
              <ul className="grid gap-2">
                {routines.map((routine) =>
                  confirming === routine.id ? (
                    <li key={routine.id} className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">Delete “{routine.title}”?</span>
                      <Button size="sm" variant="destructive" onClick={() => remove(routine.id)}>
                        Delete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirming(undefined)}>
                        Cancel
                      </Button>
                    </li>
                  ) : (
                    <li key={routine.id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{routine.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {CADENCE_LABELS[routine.cadence]}
                          {routine.phrases.length > 0 && ` · “${routine.phrases[0]}”`}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${routine.title}`}
                        onClick={() => setConfirming(routine.id)}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ),
                )}
              </ul>
            )}
            <Button size="lg" onClick={() => setAdding(true)}>
              <Plus />
              Add a routine
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewRoutineForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [instruction, setInstruction] = useState("");
  const [dueDate, setDueDate] = useState(() => inputDate(1));
  const dictation = useSpeechRecognition({ onTranscript: setInstruction, onEnd: () => {} });

  const [state, action, pending] = useActionState(async (previous: RoutineFormState, formData: FormData) => {
    const result = await createRoutine(previous, formData);
    if (result?.ok) onCreated();
    return result;
  }, undefined);

  return (
    <form action={action} className="grid gap-4">
      <FormField name="title" label="Name" placeholder="Weekly groceries" errors={state?.errors?.title} required />

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="instruction">What should I do?</Label>
          {dictation.supported && (
            <Button
              type="button"
              size="sm"
              variant={dictation.listening ? "destructive" : "ghost"}
              onClick={() => (dictation.listening ? dictation.stop() : dictation.start(instruction))}
            >
              <Mic />
              {dictation.listening ? "Listening… tap to stop" : "Say it"}
            </Button>
          )}
        </div>
        <Textarea
          id="instruction"
          name="instruction"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Order my usual groceries, then ask me before paying."
          maxLength={500}
          rows={3}
          aria-invalid={!!state?.errors?.instruction}
          required
        />
        {state?.errors?.instruction && <p className="text-sm text-destructive">{state.errors.instruction[0]}</p>}
      </div>

      <FormField
        name="phrases"
        label="How do you usually say it? (optional)"
        placeholder="the usual, my weekly shop"
        errors={state?.errors?.phrases}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="category">Type</Label>
          <select id="category" name="category" defaultValue="shopping" className={SELECT_CLASS}>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category[0].toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cadence">Repeats</Label>
          <select id="cadence" name="cadence" defaultValue="weekly" className={SELECT_CLASS}>
            {CADENCES.map((cadence) => (
              <option key={cadence} value={cadence}>
                {CADENCE_LABELS[cadence]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="dueDate">First due</Label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className={cn(SELECT_CLASS, "w-auto")}
            required
          />
          {[
            ["Today", 0],
            ["Tomorrow", 1],
            ["Next week", 7],
          ].map(([label, days]) => (
            <Button key={label} type="button" size="sm" variant="outline" onClick={() => setDueDate(inputDate(Number(days)))}>
              {label}
            </Button>
          ))}
        </div>
        {state?.errors?.dueDate && <p className="text-sm text-destructive">{state.errors.dueDate[0]}</p>}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Save routine
        </Button>
      </div>
    </form>
  );
}
