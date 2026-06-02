import Link from "next/link";
import { differenceInDays, format } from "date-fns";
import { CalendarClock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UpcomingDeadline } from "@/lib/data/dashboard";

interface DeadlineItemProps {
  deadline: UpcomingDeadline;
}

function DeadlineItem({ deadline }: DeadlineItemProps) {
  const daysLeft = differenceInDays(
    new Date(deadline.submissionDeadline),
    new Date()
  );
  const isUrgent = daysLeft <= 7;
  const isCritical = daysLeft <= 3;

  return (
    <Link
      href={`/tenders/${deadline.id}`}
      className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
    >
      {/* Day indicator */}
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg text-center",
          isCritical
            ? "bg-red-100 dark:bg-red-900/30"
            : isUrgent
            ? "bg-amber-100 dark:bg-amber-900/30"
            : "bg-slate-100 dark:bg-slate-800"
        )}
      >
        <span
          className={cn(
            "text-lg font-bold leading-none tabular-nums",
            isCritical
              ? "text-red-600"
              : isUrgent
              ? "text-amber-600"
              : "text-slate-700 dark:text-slate-300"
          )}
        >
          {format(new Date(deadline.submissionDeadline), "d")}
        </span>
        <span
          className={cn(
            "text-[10px] uppercase",
            isCritical
              ? "text-red-500"
              : isUrgent
              ? "text-amber-500"
              : "text-slate-500"
          )}
        >
          {format(new Date(deadline.submissionDeadline), "MMM")}
        </span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
          {deadline.titleEn}
        </p>
        {deadline.clientName && (
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {deadline.clientName}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-1">
          {isCritical && (
            <AlertTriangle className="h-3 w-3 text-red-500" />
          )}
          <span
            className={cn(
              "text-xs font-medium",
              isCritical
                ? "text-red-600"
                : isUrgent
                ? "text-amber-600"
                : "text-slate-500"
            )}
          >
            {daysLeft === 0
              ? "Due today"
              : daysLeft === 1
              ? "Due tomorrow"
              : `${daysLeft} days left`}
          </span>
        </div>
      </div>
    </Link>
  );
}

interface UpcomingDeadlinesProps {
  deadlines: UpcomingDeadline[];
}

export function UpcomingDeadlines({ deadlines }: UpcomingDeadlinesProps) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <CalendarClock className="h-4 w-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Upcoming Deadlines
        </h3>
      </div>

      {/* Content */}
      {deadlines.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
          <CalendarClock className="mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">No upcoming deadlines</p>
          <p className="mt-1 text-xs text-slate-400">
            Set submission deadlines when creating tenders
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-slate-50 p-2 dark:divide-slate-800/50">
          {deadlines.map((deadline) => (
            <DeadlineItem key={deadline.id} deadline={deadline} />
          ))}
        </div>
      )}
    </div>
  );
}
