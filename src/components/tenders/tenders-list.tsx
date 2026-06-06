"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  FileText,
  ListChecks,
  ScrollText,
  CalendarClock,
  ArrowRight,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TenderListItem } from "@/lib/data/tenders";

const STATUS_STYLES: Record<string, { label: string; pill: string; dot: string }> = {
  DRAFT: { label: "Draft", pill: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", dot: "bg-slate-400" },
  ACTIVE: { label: "Active", pill: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300", dot: "bg-blue-500" },
  SUBMITTED: { label: "Submitted", pill: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300", dot: "bg-violet-500" },
  WON: { label: "Won", pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300", dot: "bg-emerald-500" },
  LOST: { label: "Lost", pill: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300", dot: "bg-red-500" },
  NO_DECISION: { label: "No Decision", pill: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300", dot: "bg-amber-500" },
  CANCELLED: { label: "Cancelled", pill: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400", dot: "bg-slate-400" },
};

const FILTERS = ["ALL", "ACTIVE", "SUBMITTED", "DRAFT", "WON", "LOST"] as const;

function formatValue(v: number | null, currency: string): string {
  if (v == null || v === 0) return "—";
  const sym = currency === "USD" ? "$" : `${currency} `;
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${sym}${(v / 1_000).toFixed(0)}K`;
  return `${sym}${v.toLocaleString()}`;
}

function deadlineInfo(d: Date | null): { text: string; tone: string } {
  if (!d) return { text: "No deadline", tone: "text-slate-400" };
  const date = new Date(d);
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  const text = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (days < 0) return { text: `${text} · overdue`, tone: "text-red-500" };
  if (days <= 3) return { text: `${text} · ${days}d left`, tone: "text-amber-600" };
  if (days <= 14) return { text: `${text} · ${days}d left`, tone: "text-slate-500" };
  return { text, tone: "text-slate-500" };
}

export function TendersList({ tenders }: { tenders: TenderListItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: tenders.length };
    for (const t of tenders) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tenders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenders.filter((t) => {
      if (filter !== "ALL" && t.status !== filter) return false;
      if (!q) return true;
      return (
        t.titleEn.toLowerCase().includes(q) ||
        (t.clientName ?? "").toLowerCase().includes(q) ||
        (t.referenceNo ?? "").toLowerCase().includes(q)
      );
    });
  }, [tenders, query, filter]);

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => {
            const active = filter === f;
            const n = counts[f] ?? 0;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                  active
                    ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                )}
              >
                {f === "ALL" ? "All" : STATUS_STYLES[f]?.label ?? f}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] tabular-nums",
                    active ? "bg-white/20 dark:bg-slate-900/10" : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, client, ref…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-blue-950"
          />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <p className="text-sm font-medium text-slate-500">No tenders match your filters</p>
          <p className="mt-1 text-xs text-slate-400">Try a different status or search term.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((t) => {
            const s = STATUS_STYLES[t.status] ?? STATUS_STYLES.DRAFT;
            const dl = deadlineInfo(t.submissionDeadline);
            return (
              <Link
                key={t.id}
                href={`/tenders/${t.id}`}
                className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:shadow-none"
              >
                <span className={cn("absolute inset-y-0 left-0 w-1", s.dot)} />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 pl-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", s.pill)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                        {s.label}
                      </span>
                      {t.referenceNo && (
                        <span className="truncate text-xs text-slate-400">{t.referenceNo}</span>
                      )}
                    </div>
                    <h3 className="mt-2 truncate text-base font-semibold text-slate-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
                      {t.titleEn}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      {t.clientName && <span className="font-medium text-slate-600 dark:text-slate-300">{t.clientName}</span>}
                      <span className={cn("inline-flex items-center gap-1", dl.tone)}>
                        <CalendarClock className="h-3.5 w-3.5" />
                        {dl.text}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5" />
                        {t.primaryLanguage}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 pl-2 sm:pl-0">
                    <Metric icon={FileText} value={t.counts.documents} label="docs" />
                    <Metric icon={ListChecks} value={t.counts.requirements} label="reqs" />
                    <Metric icon={ScrollText} value={t.counts.proposals} label="props" />
                    <div className="hidden text-right md:block">
                      <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                        {formatValue(t.estimatedValue, t.currency)}
                      </p>
                      <p className="text-[11px] text-slate-400">est. value</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
    </div>
  );
}
