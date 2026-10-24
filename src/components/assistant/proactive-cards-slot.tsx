import { Suspense } from "react";
import { ProactiveCards } from "@/components/assistant/proactive-cards";
import { Skeleton } from "@/components/ui/skeleton";
import { listUpcomingRoutines } from "@/lib/routines";

/** Loads the signed-in user's due routines behind a Suspense boundary, so the page shell stays static. */
export function ProactiveCardsSlot() {
  return (
    <Suspense fallback={<CardsSkeleton />}>
      <Cards />
    </Suspense>
  );
}

async function Cards() {
  return <ProactiveCards initial={await listUpcomingRoutines()} />;
}

function CardsSkeleton() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2" aria-hidden>
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-36 rounded-2xl" />
    </div>
  );
}
