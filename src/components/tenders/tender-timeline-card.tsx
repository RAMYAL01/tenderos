"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, CheckCircle2, Circle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { planTenderTimeline, toggleTenderMilestone } from "@/lib/actions/tender-timeline";

export interface TimelineMilestone {
  id: string;
  key: string;
  label: string;
  dueAt: string; // ISO
  done: boolean;
}

export function TenderTimelineCard({
  tenderId,
  milestones,
  hasDeadline,
  canEdit,
}: {
  tenderId: string;
  milestones: TimelineMilestone[];
  hasDeadline: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function plan() {
    setBusyId(null);
    start(async () => {
      const res = await planTenderTimeline(tenderId);
      if (!res.success) {
        toast({ title: "Couldn't plan the schedule", description: res.error, variant: "destructive" });
        return;
      }
      router.refresh();
    });
  }

  function toggle(m: TimelineMilestone) {
    setBusyId(m.id);
    start(async () => {
      const res = await toggleTenderMilestone(m.id, tenderId, !m.done);
      setBusyId(null);
      if (!res.success) {
        toast({ title: "Couldn't update", description: res.error, variant: "destructive" });
        return;
      }
      router.refresh();
    });
  }

  const now = Date.now();
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Bid schedule</h3>
        {milestones.length > 0 && canEdit && (
          <button
            onClick={plan}
            disabled={pending}
            className="ml-auto rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            title="Re-plan from the deadline"
          >
            {pending && busyId === null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {milestones.length === 0 ? (
        <>
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            Reverse-plan the bid from the submission deadline — Bid/No-Bid, drafts, review, and QA, paced back from submit day.
          </p>
          {canEdit ? (
            <>
              <Button size="sm" className="w-full" onClick={plan} disabled={pending || !hasDeadline}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                Plan the schedule
              </Button>
              {!hasDeadline && <p className="mt-1.5 text-[11px] text-slate-400">Set a submission deadline first.</p>}
            </>
          ) : (
            <p className="text-[11px] text-slate-400">A Writer or above can plan the schedule.</p>
          )}
        </>
      ) : (
        <ol className="space-y-3">
          {milestones.map((m) => {
            const overdue = !m.done && new Date(m.dueAt).getTime() < now;
            return (
              <li key={m.id} className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => canEdit && toggle(m)}
                  disabled={!canEdit || (pending && busyId === m.id)}
                  className={cn("mt-0.5 shrink-0", canEdit ? "cursor-pointer" : "cursor-default")}
                  aria-label={m.done ? "Mark not done" : "Mark done"}
                >
                  {busyId === m.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : m.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className={cn("h-4 w-4", overdue ? "text-red-400" : "text-slate-300 dark:text-slate-600")} />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-xs", m.done ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-200")}>
                    {m.label}
                  </p>
                  <p className={cn("text-[11px] tabular-nums", overdue ? "font-medium text-red-500" : "text-slate-400")}>
                    {fmt(m.dueAt)}
                    {overdue ? " · overdue" : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
