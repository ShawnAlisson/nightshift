"use client";

import {
  Bell,
  CalendarClock,
  Pill,
  Plus,
  Receipt,
  ShoppingBasket,
  SkipForward,
  Sparkles,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import {
  addExampleRoutines,
  completeRoutine,
  fetchUpcomingRoutines,
  snoozeRoutine,
} from "@/actions/routines";
import { useChatActions } from "@/components/assistant/chat-actions";
import { RoutinesDialog } from "@/components/assistant/routines-dialog";
import { Button } from "@/components/ui/button";
import type { Category, RoutineSummary } from "@/lib/routine-schedule";
import { cn } from "@/lib/utils";

const CATEGORY_STYLE: Record<Category, { icon: LucideIcon; tint: string }> = {
  shopping: { icon: ShoppingBasket, tint: "bg-chart-3/15 text-chart-3" },
  bill: { icon: Receipt, tint: "bg-chart-4/20 text-chart-4" },
  account: { icon: UserCog, tint: "bg-chart-2/15 text-chart-2" },
  health: { icon: Pill, tint: "bg-chart-5/15 text-chart-5" },
  other: { icon: Bell, tint: "bg-primary/15 text-primary" },
};

const DAY_MS = 24 * 60 * 60 * 1000;
const subscribeNever = () => () => {};

/** Whole days from today until the due day (negative if overdue). Null on the server, where "today" is unknown. */
function useDaysUntil(dueAt: string) {
  return useSyncExternalStore(
    subscribeNever,
    () => {
      const due = new Date(dueAt);
      const now = new Date();
      // A routine is due on a calendar day, stored at noon UTC, so compare days in UTC against the local date.
      const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
      const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
      return Math.round((dueDay - today) / DAY_MS);
    },
    () => null,
  );
}

function dueText(days: number) {
  if (days < 0) return `Overdue by ${-days} ${days === -1 ? "day" : "days"}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

function RoutineCard({
  routine,
  onRun,
  onLater,
  onSkip,
}: {
  routine: RoutineSummary;
  onRun: () => void;
  onLater: () => void;
  onSkip: () => void;
}) {
  const days = useDaysUntil(routine.dueAt);
  const urgent = days !== null && days <= 0;
  const { icon: Icon, tint } = CATEGORY_STYLE[routine.category];

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-2xl bg-card p-4 text-left shadow-sm ring-1",
        urgent ? "ring-primary/40" : "ring-foreground/10",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tint)}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium">{routine.title}</h3>
          <p className={cn("flex items-center gap-1 text-xs", urgent ? "font-medium text-primary" : "text-muted-foreground")}>
            <CalendarClock className="size-3.5" />
            {days === null ? " " : dueText(days)}
          </p>
        </div>
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{routine.instruction}</p>
      <div className="mt-auto flex items-center gap-2">
        <Button size="lg" className="flex-1" onClick={onRun}>
          <Sparkles />
          Do it now
        </Button>
        <Button size="lg" variant="ghost" onClick={onLater}>
          Later
        </Button>
        <Button size="icon-lg" variant="ghost" aria-label={`Skip ${routine.title}`} title="Skip this time" onClick={onSkip}>
          <SkipForward />
        </Button>
      </div>
    </li>
  );
}

/** Reminders and routines that are due, as cards the assistant can act on in one tap. */
export function ProactiveCards({ initial }: { initial: RoutineSummary[] }) {
  const { run } = useChatActions();
  const [cards, setCards] = useState(initial);
  const [managing, setManaging] = useState(false);

  const refresh = async () => setCards(await fetchUpcomingRoutines());
  const remove = (id: string) => setCards((current) => current.filter((card) => card.id !== id));

  function runCard(card: RoutineSummary) {
    remove(card.id);
    run(card.instruction);
    // The routine moves to its next date as soon as it is started.
    void completeRoutine(card.id);
  }

  return (
    <section aria-label="Coming up" className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Coming up</h2>
        <Button variant="ghost" size="sm" onClick={() => setManaging(true)}>
          <Plus />
          Routines
        </Button>
      </div>

      {cards.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {cards.map((card) => (
            <RoutineCard
              key={card.id}
              routine={card}
              onRun={() => runCard(card)}
              onLater={() => {
                remove(card.id);
                void snoozeRoutine(card.id);
              }}
              onSkip={() => {
                remove(card.id);
                void completeRoutine(card.id);
              }}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl bg-card p-5 text-center ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">
            Nothing is due. Save routines like your weekly shop or a bill, and I&apos;ll remind you when they&apos;re due.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button size="lg" onClick={() => setManaging(true)}>
              <Plus />
              Add a routine
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={async () => {
                await addExampleRoutines();
                await refresh();
              }}
            >
              Try examples
            </Button>
          </div>
        </div>
      )}

      <RoutinesDialog open={managing} onOpenChange={setManaging} onChange={refresh} />
    </section>
  );
}
