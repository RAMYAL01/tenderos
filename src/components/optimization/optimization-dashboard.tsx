"use client";

import Link from "next/link";
import {
  TrendingUp,
  ShieldCheck,
  FileText,
  DollarSign,
  History,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import type {
  OptimizationReport,
  ScoreDetail,
  RiskLevel,
} from "@/lib/optimization/score";

const LEVEL_RING: Record<RiskLevel, string> = {
  low: "text-emerald-500",
  medium: "text-amber-500",
  high: "text-rose-500",
};
const LEVEL_BG: Record<RiskLevel, string> = {
  low: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  medium: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  high: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
};

function Gauge({ score, level }: { score: number; level: RiskLevel }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          className="stroke-slate-100 dark:stroke-slate-800"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className={LEVEL_RING[level]}
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-slate-900 dark:text-white">
          {score}
          <span className="text-lg text-slate-400">%</span>
        </span>
      </div>
    </div>
  );
}

function ScoreBar({ score, level }: { score: number; level: RiskLevel }) {
  const fill =
    level === "low"
      ? "bg-emerald-500"
      : level === "medium"
      ? "bg-amber-500"
      : "bg-rose-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div
        className={`h-full rounded-full ${fill}`}
        style={{ width: `${score}%`, transition: "width 0.8s ease" }}
      />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof ShieldCheck;
  title: string;
  detail: ScoreDetail;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
            <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </span>
        </div>
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${LEVEL_BG[detail.level]}`}
        >
          {detail.score}%
        </span>
      </div>
      <ScoreBar score={detail.score} level={detail.level} />
      <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {detail.detail}
      </p>
    </div>
  );
}

const REASON_LABEL: Record<string, string> = {
  no_response: "No response",
  not_started: "Not started",
  flagged: "Flagged",
};

export function OptimizationDashboard({
  tenderId,
  report,
  hasFinancial,
}: {
  tenderId: string;
  report: OptimizationReport;
  hasFinancial: boolean;
}) {
  const { winProbability, compliance, completeness, pricing, historical, missing, recommendations } =
    report;

  return (
    <div className="space-y-6">
      {/* Hero: win probability */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <Gauge score={winProbability.score} level={winProbability.level} />
          <div className="flex-1 text-center sm:text-left">
            <div className="mb-1 flex items-center justify-center gap-2 sm:justify-start">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Win Probability — {winProbability.label}
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {winProbability.detail}
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Scores are computed deterministically from your requirements,
              compliance matrix, proposal sections, and priced financials. No AI
              estimates a number here.
            </p>
          </div>
        </div>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard icon={ShieldCheck} title="Compliance" detail={compliance} />
        <MetricCard icon={FileText} title="Proposal Completeness" detail={completeness} />

        {/* Pricing card (custom — risk-shaped) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <DollarSign className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </div>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Pricing Risk
              </span>
            </div>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold ${LEVEL_BG[pricing.level]}`}
            >
              {pricing.level === "low" ? "Low" : pricing.level === "medium" ? "Medium" : "High"}
            </span>
          </div>
          <ScoreBar score={pricing.riskScore} level={pricing.level} />
          <ul className="mt-3 space-y-1.5">
            {pricing.notes.map((n, i) => (
              <li
                key={i}
                className="flex gap-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400"
              >
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                {n}
              </li>
            ))}
          </ul>
          {!hasFinancial && (
            <Link
              href={`/tenders/${tenderId}/financial`}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
            >
              Build the financial proposal <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Missing requirements */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Gaps to close
            </h3>
            <span className="text-xs text-slate-400">
              {missing.length} open
            </span>
          </div>

          {missing.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-6 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              Every requirement has a response. Nothing outstanding.
            </div>
          ) : (
            <ul className="space-y-2">
              {missing.slice(0, 12).map((m) => (
                <li
                  key={m.id}
                  className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2.5 dark:border-slate-800"
                >
                  <span
                    className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      m.requirementType === "MANDATORY"
                        ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                    }`}
                  >
                    {m.requirementType === "MANDATORY" ? "MUST" : "OPT"}
                  </span>
                  <p className="flex-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {m.text}
                  </p>
                  <span className="shrink-0 text-[10px] font-medium text-slate-400">
                    {REASON_LABEL[m.reason]}
                  </span>
                </li>
              ))}
              {missing.length > 12 && (
                <li className="pt-1 text-center text-xs text-slate-400">
                  +{missing.length - 12} more —{" "}
                  <Link
                    href={`/tenders/${tenderId}/compliance`}
                    className="text-blue-600 hover:underline"
                  >
                    open the compliance matrix
                  </Link>
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Recommendations + history */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Recommended next moves
              </h3>
            </div>
            <ol className="space-y-2.5">
              {recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-600 dark:bg-blue-950/50">
                    {i + 1}
                  </span>
                  {rec}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Historical track record
              </h3>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {historical.winRate}%
              </span>
              <span className="text-xs text-slate-400">win rate</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {historical.label}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
