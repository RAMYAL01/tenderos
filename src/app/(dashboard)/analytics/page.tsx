import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuthContext } from "@/lib/auth";
import { getAnalytics } from "@/lib/data/analytics";
import {
  StatCard,
  Panel,
  WinRateRing,
  HBars,
  MonthlyBars,
  UsageBar,
  TeamTable,
  formatCurrency,
  formatCompact,
} from "@/components/analytics/charts";

export const metadata = { title: "Analytics" };

async function AnalyticsContent() {
  const { org } = await getAuthContext();
  const a = await getAnalytics(org.id);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Win Rate"
          value={`${a.totals.winRate}%`}
          sub={`${a.totals.won} won · ${a.totals.lost} lost`}
          accent="emerald"
        />
        <StatCard
          label="Active Pipeline"
          value={formatCurrency(a.pipeline.activeValue, a.pipeline.currency)}
          sub={`${a.totals.active + a.totals.submitted} live bids`}
          accent="blue"
        />
        <StatCard
          label="Total Tenders"
          value={a.totals.total}
          sub={`${a.totals.submitted} submitted · ${a.totals.active} active`}
          accent="violet"
        />
        <StatCard
          label="Won Value"
          value={formatCurrency(a.pipeline.wonValue, a.pipeline.currency)}
          sub={`${a.totals.won} contracts won`}
          accent="amber"
        />
      </div>

      {/* Win rate + status breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Bid Outcomes">
          <WinRateRing percent={a.totals.winRate} won={a.totals.won} lost={a.totals.lost} />
        </Panel>
        <div className="lg:col-span-2">
          <Panel title="Tenders by Status">
            <HBars items={a.statusBreakdown} empty="No tenders yet — create one to see analytics." />
          </Panel>
        </div>
      </div>

      {/* Monthly trend */}
      <Panel title="Activity — last 6 months">
        <MonthlyBars data={a.monthly} />
      </Panel>

      {/* Proposals + Language */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Proposals by Status">
          <div className="mb-4 flex gap-6">
            <div>
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                {a.proposals.total}
              </p>
              <p className="text-xs text-slate-400">total proposals</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                {a.proposals.avgCompliance != null ? `${a.proposals.avgCompliance}%` : "—"}
              </p>
              <p className="text-xs text-slate-400">avg compliance</p>
            </div>
          </div>
          <HBars items={a.proposals.byStatus} empty="No proposals yet." />
        </Panel>

        <Panel title="Tenders by Language">
          <HBars items={a.language} empty="No tenders yet." />
        </Panel>
      </div>

      {/* AI usage + Team */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="AI Usage">
          <UsageBar used={a.ai.creditsUsed} limit={a.ai.creditsLimit} />
          <div className="mt-5 grid grid-cols-3 gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <MiniStat label="AI Jobs" value={formatCompact(a.ai.totalJobs)} />
            <MiniStat label="Tokens" value={formatCompact(a.ai.totalTokens)} />
            <MiniStat label="Spend" value={`$${a.ai.totalCostUsd.toFixed(2)}`} />
          </div>
        </Panel>

        <Panel title="Team Activity">
          <TeamTable rows={a.team} />
        </Panel>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl lg:col-span-2" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Win rates, pipeline value, proposal performance, team activity, and AI usage."
      />
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsContent />
      </Suspense>
    </>
  );
}
