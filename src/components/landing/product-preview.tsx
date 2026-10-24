import { CalendarClock, Mic, ShoppingBasket, Sparkles } from "lucide-react";

/**
 * A small illustration of the real screen: the voice orb, a spoken request and the
 * assistant's answer, and a due-routine card. Decorative, so it is hidden from screen readers.
 */
export function ProductPreview() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-primary/10 blur-2xl" />
      <div className="rounded-3xl bg-card p-5 shadow-xl ring-1 ring-foreground/10">
        <div className="flex flex-col items-center gap-2 pb-5">
          <div className="relative">
            <span className="absolute -inset-3 rounded-full bg-primary/15" />
            <span className="absolute -inset-6 rounded-full bg-primary/5" />
            <span className="relative flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <Mic className="size-7" />
            </span>
          </div>
          <p className="mt-4 text-xs font-medium text-muted-foreground">Listening… just talk</p>
        </div>

        <div className="grid gap-3 text-left text-sm">
          <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground">
            Order my usual groceries
          </p>
          <div className="flex gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Sparkles className="size-3.5" />
            </span>
            <p className="pt-0.5 leading-relaxed">
              On it. Your basket has your 14 usual items. Shall I check out? Tell me yes, and I&apos;ll pay.
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-muted/50 p-3 text-left ring-1 ring-primary/30">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-chart-3/15 text-chart-3">
            <ShoppingBasket className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Weekly groceries</p>
            <p className="flex items-center gap-1 text-xs font-medium text-primary">
              <CalendarClock className="size-3.5" /> Due today
            </p>
          </div>
          <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Do it now</span>
        </div>
      </div>
    </div>
  );
}
