/**
 * Lightweight, dependency-free analytics visualizations (server components).
 * Pure SVG/CSS — no client interactivity required.
 */

import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  sub,
  accent = "blue",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: "blue" | "emerald" | "violet" | "amber" | "slate";
}) {
  const bar: Record<string, string> = {
    blue: "from-blue-500 to-cyan-400",
    emerald: "from-emerald-500 to-teal-400",
    violet: "from-violet-500 to-fuchsia-400",
    amber: "from-amber-500 to-orange-400",
    slate: "from-slate-400 to-slate-300",
  };
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${bar[accent]}`} />
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Donut ring showing a single percentage (e.g. win rate). */
export function WinRateRing({ percent, won, lost }: { percent: number; won: number; lost: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <div className="flex items-center gap-6">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" strokeWidth="12" className="stroke-slate-100 dark:stroke-slate-800" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            stroke="url(#winGrad)"
            strokeDasharray={`${filled} ${c - filled}`}
          />
          <defs>
            <linearGradient id="winGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{percent}%</span>
          <span className="text-[11px] text-slate-400">win rate</span>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-slate-600 dark:text-slate-300">Won</span>
          <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{won}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="text-slate-600 dark:text-slate-300">Lost</span>
          <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{lost}</span>
        </div>
        <p className="pt-1 text-xs text-slate-400">
          {won + lost === 0 ? "No decided bids yet" : `${won + lost} decided bids`}
        </p>
      </div>
    </div>
  );
}

const BAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-rose-500",
  "bg-slate-400",
];

/** Horizontal bar list. */
export function HBars({ items, empty }: { items: Array<{ label: string; count: number }>; empty?: string }) {
  if (!items.length) return <EmptyHint>{empty ?? "No data yet."}</EmptyHint>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={it.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300">{it.label}</span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{it.count}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
              style={{ width: `${Math.max(4, (it.count / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Grouped vertical bars for a monthly trend (created vs won). */
export function MonthlyBars({ data }: { data: Array<{ month: string; created: number; won: number }> }) {
  const max = Math.max(...data.map((d) => Math.max(d.created, d.won)), 1);
  return (
    <div>
      <div className="flex items-end justify-between gap-3" style={{ height: 160 }}>
        {data.map((d) => (
          <div key={d.month} className="flex flex-1 flex-col items-center justify-end gap-1">
            <div className="flex h-full w-full items-end justify-center gap-1">
              <div
                className="w-3 rounded-t bg-gradient-to-t from-blue-600 to-cyan-400"
                style={{ height: `${(d.created / max) * 100}%`, minHeight: d.created ? 4 : 0 }}
                title={`${d.created} created`}
              />
              <div
                className="w-3 rounded-t bg-gradient-to-t from-emerald-600 to-emerald-400"
                style={{ height: `${(d.won / max) * 100}%`, minHeight: d.won ? 4 : 0 }}
                title={`${d.won} won`}
              />
            </div>
            <span className="text-[11px] text-slate-400">{d.month}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-t from-blue-600 to-cyan-400" /> Created
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-t from-emerald-600 to-emerald-400" /> Won
        </span>
      </div>
    </div>
  );
}

/** Progress bar for usage (AI credits). */
export function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const near = pct > 80;
  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
          {used.toLocaleString()}
          <span className="ml-1 text-sm font-normal text-slate-400">
            / {limit >= 999_999 ? "∞" : limit.toLocaleString()} credits
          </span>
        </span>
        <span className={`text-xs font-medium ${near ? "text-amber-600" : "text-slate-400"}`}>
          {Math.round(pct)}%
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${near ? "from-amber-400 to-orange-500" : "from-blue-500 to-cyan-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function TeamTable({ rows }: { rows: Array<{ name: string; tenders: number; proposals: number }> }) {
  if (!rows.length) return <EmptyHint>No team activity yet.</EmptyHint>;
  return (
    <div className="overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 border-b border-slate-100 pb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:border-slate-800">
        <span>Member</span>
        <span className="text-right">Tenders</span>
        <span className="text-right">Proposals</span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((r) => (
          <div key={r.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 py-2.5 text-sm">
            <span className="truncate text-slate-700 dark:text-slate-200">{r.name}</span>
            <span className="text-right font-semibold tabular-nums text-slate-900 dark:text-white">{r.tenders}</span>
            <span className="text-right font-semibold tabular-nums text-slate-900 dark:text-white">{r.proposals}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-400">{children}</p>;
}

// ── formatting helpers ──
export function formatCurrency(value: number, currency = "USD"): string {
  const sym = currency === "USD" ? "$" : `${currency} `;
  if (value >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${sym}${(value / 1_000).toFixed(1)}K`;
  return `${sym}${value.toLocaleString()}`;
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}
