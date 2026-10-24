import { Skeleton } from "@/components/ui/skeleton";

export function ChatSkeleton() {
  return (
    <div className="grid gap-5 py-6" aria-hidden>
      <Skeleton className="ml-auto h-10 w-2/5" />
      <Skeleton className="h-20 w-4/5" />
    </div>
  );
}
