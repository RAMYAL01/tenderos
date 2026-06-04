import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/lib/data/dashboard";
import {
  FolderOpen,
  CheckSquare,
  FileText,
  Zap,
  TrendingUp,
} from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  trend?: { value: number; label: string } | null;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
}: StatCardProps) {
  return (
    <div className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:shadow-none">
      {/* Hover sheen */}
      <span className="pointer-events-none absolute -inset-px -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-slate-100/60 to-transparent opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100 dark:via-white/[0.03]" />
      <div className="flex items-start justify-between">
        <div className={cn("rounded-lg p-2 transition-transform duration-300 group-hover:scale-110", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        {trend && (
          <div className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:bg-emerald-950/50">
            <TrendingUp className="h-3 w-3" />
            <span>+{trend.value}%</span>
          </div>
        )}
      </div>

      <div>
        <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
          {value}
        </p>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {title}
        </p>
        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const complianceDisplay =
    stats.avgComplianceScore != null
      ? `${Math.round(stats.avgComplianceScore)}%`
      : "—";

  const complianceColor =
    stats.avgComplianceScore == null
      ? "text-slate-400"
      : stats.avgComplianceScore >= 80
      ? "text-emerald-600"
      : stats.avgComplianceScore >= 60
      ? "text-amber-600"
      : "text-red-600";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Active Tenders"
        value={stats.activeTenders}
        subtitle={`${stats.totalTenders} total all-time`}
        icon={FolderOpen}
        iconColor="text-blue-600"
        iconBg="bg-blue-50 dark:bg-blue-900/30"
      />

      <div className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:shadow-none">
        <span className="pointer-events-none absolute -inset-px -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-slate-100/60 to-transparent opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100 dark:via-white/[0.03]" />
        <div className="flex items-start justify-between">
          <div className="rounded-lg bg-emerald-50 p-2 transition-transform duration-300 group-hover:scale-110 dark:bg-emerald-900/30">
            <CheckSquare className="h-5 w-5 text-emerald-600" />
          </div>
        </div>
        <div>
          <p className={cn("text-2xl font-bold tabular-nums", complianceColor)}>
            {complianceDisplay}
          </p>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Avg Compliance Score
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Across active tenders
          </p>
        </div>
      </div>

      <StatCard
        title="Proposals This Month"
        value={stats.proposalsThisMonth}
        subtitle="Technical proposals drafted"
        icon={FileText}
        iconColor="text-violet-600"
        iconBg="bg-violet-50 dark:bg-violet-900/30"
      />

      <StatCard
        title="AI Generations Used"
        value={stats.aiCreditsUsed}
        subtitle={`of ${stats.aiCreditsLimit} this month`}
        icon={Zap}
        iconColor="text-amber-600"
        iconBg="bg-amber-50 dark:bg-amber-900/30"
      />
    </div>
  );
}
