"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActivationProgress } from "@/lib/data/activation";

/**
 * Persistent new-org activation checklist (PLG). Shown on the dashboard until
 * every milestone is done, then it disappears on its own. Server computes the
 * progress from real data; this just renders + sequences the next action.
 * Collapse preference is remembered per-org in localStorage.
 */
export function ActivationChecklist({ progress, orgId }: { progress: ActivationProgress; orgId: string }) {
  const storageKey = `activation-collapsed:${orgId}`;
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(storageKey) === "1");
    setReady(true);
  }, [storageKey]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(storageKey, next ? "1" : "0");
  }

  const pct = Math.round((progress.done / progress.total) * 100);
  // The single next action to nudge (first incomplete step).
  const nextStep = progress.steps.find((s) => !s.done);

  if (!ready) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50 to-indigo-50 dark:border-blue-900/40 dark:from-blue-950/40 dark:to-indigo-950/30">
      <div className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-600/25">
          <Rocket className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-semibold text-slate-900 dark:text-white">Get set up on TenderOS</h3>
            <span className="shrink-0 text-sm font-medium text-blue-700 dark:text-blue-300">
              {progress.done}/{progress.total} done
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button
          onClick={toggle}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/60 hover:text-slate-600 dark:hover:bg-slate-800/60"
          aria-label={collapsed ? "Expand checklist" : "Collapse checklist"}
        >
          {collapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
        </button>
      </div>

      {!collapsed && (
        <ul className="divide-y divide-blue-100/70 border-t border-blue-100/70 dark:divide-blue-900/30 dark:border-blue-900/30">
          {progress.steps.map((s) => {
            const isNext = s.key === nextStep?.key;
            return (
              <li
                key={s.key}
                className={`flex items-center gap-3 px-5 py-3 ${isNext ? "bg-white/60 dark:bg-slate-900/40" : ""}`}
              >
                {s.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className={`h-5 w-5 shrink-0 ${isNext ? "text-blue-500" : "text-slate-300 dark:text-slate-600"}`} />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${s.done ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-800 dark:text-slate-100"}`}>
                    {s.label}
                  </p>
                  {!s.done && isNext && <p className="text-xs text-slate-500">{s.hint}</p>}
                </div>
                {!s.done && (
                  <Button asChild size="sm" variant={isNext ? "default" : "outline"}>
                    <Link href={s.href}>{s.cta}</Link>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
