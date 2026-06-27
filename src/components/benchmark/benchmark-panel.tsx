import Link from "next/link";
import { BarChart3, Lock, Users, Trophy, TrendingDown } from "lucide-react";
import type { ValueBand } from "@prisma/client";
import type { AwardBenchmark } from "@/lib/benchmark/read";
import { VALUE_BAND_LABELS } from "@/lib/benchmark/bands";

/**
 * Market Benchmark — surfaces the k-anonymized cross-customer award pool at the
 * decision point (the tender's {sector, country, valueBand} cell). Presentational
 * server component; the page fetches + gates the data. Three states:
 *   gated      → Starter tier, locked upsell
 *   suppressed → fewer than the k-anonymity threshold pooled, "still pooling"
 *   data       → the live benchmark
 */

const LOSS_LABELS: Record<string, string> = {
  PRICE: "Price",
  TECHNICAL_SCORE: "Technical score",
  LOCAL_CONTENT: "Local content",
  LATE_SUBMISSION: "Late submission",
  INCOMPLETE_SUBMISSION: "Incomplete",
  DISQUALIFIED: "Disqualified",
  NO_BID: "No bid",
  OTHER: "Other",
};

function titleCase(s: string): string {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtMoney(major: number, currency: string | null): string {
  const abs = Math.abs(major);
  const s =
    abs >= 1_000_000_000 ? (major / 1_000_000_000).toFixed(1) + "B"
    : abs >= 1_000_000 ? (major / 1_000_000).toFixed(1) + "M"
    : abs >= 1_000 ? (major / 1_000).toFixed(0) + "K"
    : major.toFixed(0);
  return currency ? `${currency} ${s}` : s;
}

function cellLabel(cell: { sector: string | null; country: string | null; valueBand: ValueBand | null }): string {
  return [
    cell.sector ? titleCase(cell.sector) : "All sectors",
    cell.country ? cell.country.toUpperCase() : "All regions",
    cell.valueBand && cell.valueBand !== "UNKNOWN" ? VALUE_BAND_LABELS[cell.valueBand] : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      {children}
    </div>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Market benchmark</h3>
        <span className="ml-auto rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          Pooled · anonymized
        </span>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">{subtitle}</p>
    </div>
  );
}

export function BenchmarkPanel({
  gated,
  benchmark,
  cell,
}: {
  gated: boolean;
  benchmark: AwardBenchmark | null;
  cell: { sector: string | null; country: string | null; valueBand: ValueBand | null };
}) {
  const subtitle = cellLabel(cell);

  // ── Gated: Starter tier ──────────────────────────────────────────────────
  if (gated) {
    return (
      <Shell>
        <Header subtitle={subtitle} />
        <div className="flex flex-col items-center gap-2 rounded-lg bg-slate-50 px-3 py-4 text-center dark:bg-slate-800/40">
          <Lock className="h-5 w-5 text-slate-400" />
          <p className="text-xs text-slate-600 dark:text-slate-300">
            See what actually wins in this market — median winning bid, who&apos;s winning, and why bids lose.
          </p>
          <Link
            href="/settings/billing"
            className="mt-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Upgrade to unlock
          </Link>
        </div>
      </Shell>
    );
  }

  // ── Still pooling (below k-anonymity threshold) ──────────────────────────
  if (!benchmark || benchmark.suppressed) {
    return (
      <Shell>
        <Header subtitle={subtitle} />
        <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-500 dark:bg-slate-800/40">
          Pooling awards for this segment. Benchmarks unlock once enough outcomes are
          recorded across the market{benchmark ? ` (${benchmark.cohortSize} so far)` : ""}. Every
          debrief you record helps build it.
        </p>
      </Shell>
    );
  }

  const b = benchmark;
  return (
    <Shell>
      <Header subtitle={subtitle} />

      {/* Median winning value + range */}
      {b.median != null && (
        <div className="mb-3">
          <p className="text-[11px] text-slate-500">Median winning bid</p>
          <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
            {fmtMoney(b.median, b.currency)}
          </p>
          {b.p25 != null && b.p75 != null && (
            <p className="text-[11px] text-slate-400">
              typical range {fmtMoney(b.p25, b.currency)} – {fmtMoney(b.p75, b.currency)}
            </p>
          )}
        </div>
      )}

      {/* Win rate + bidders */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        {b.winRate != null && (
          <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-800/40">
            <p className="text-[10px] text-slate-500">Win rate (pool)</p>
            <p className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
              {Math.round(b.winRate * 100)}%
            </p>
          </div>
        )}
        {b.avgBidders != null && (
          <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-800/40">
            <p className="flex items-center gap-1 text-[10px] text-slate-500">
              <Users className="h-3 w-3" /> Avg bidders
            </p>
            <p className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
              {b.avgBidders}
            </p>
          </div>
        )}
      </div>

      {/* Top winners */}
      {b.topWinners.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            <Trophy className="h-3 w-3 text-amber-500" /> Most active winners
          </p>
          <ul className="space-y-0.5">
            {b.topWinners.slice(0, 4).map((w) => (
              <li key={w.name} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span className="truncate pr-2">{w.name}</span>
                <span className="shrink-0 tabular-nums text-slate-400">{w.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Loss reasons */}
      {b.lossReasons.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            <TrendingDown className="h-3 w-3 text-red-500" /> Why bids lose here
          </p>
          <div className="flex flex-wrap gap-1">
            {b.lossReasons.slice(0, 4).map((r) => (
              <span key={r.reason} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {LOSS_LABELS[r.reason] ?? titleCase(r.reason)} · {r.count}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="border-t border-slate-100 pt-2 text-[10px] text-slate-400 dark:border-slate-800">
        Based on {b.cohortSize} pooled awards across the market · anonymized
      </p>
    </Shell>
  );
}
