import { Skeleton } from "@/components/ui/skeleton";

/** Shared streaming fallback for dashboard list/detail pages. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="p-6 sm:p-8">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
