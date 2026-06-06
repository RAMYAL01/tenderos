import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/lib/data/dashboard";
import { FolderOpen, ShieldCheck, FileText, Zap } from "lucide-react";

interface CardConfig {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  grad: string; // icon chip gradient
  shadow: string; // icon chip shadow
  glow: string; // corner glow gradient
  valueColor?: string;
  progress?: number; // 0..1, renders a mini usage bar
}

function StatCard({ c }: { c: CardConfig }) {
  const Icon = c.icon;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-none">
      {/* Corner glow */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-40",
          c.glow
        )}
      />
      {/* Hover sheen */}
      <span className="pointer-events-none absolute -inset-px -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 transition-all duration-700 group-hover:left-[130%] group-hover:opacity-100 dark:via-white/[0.04]" />

      <div className="relative flex items-start justify-between">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg transition-transform duration-300 group-hover:scale-105",
            c.grad,
            c.shadow
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <p
        className={cn(
          "relative mt-4 text-3xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white",
          c.valueColor
        )}
      >
        {c.value}
      </p>
      <p className="relative mt-0.5 text-sm font-medium text-slate-600 dark:text-slate-300">
        {c.title}
      </p>
      <p className="relative mt-0.5 text-xs text-slate-400 dark:text-slate-500">{c.subtitle}</p>

      {c.progress != null && (
        <div className="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={cn("h-full rounded-full bg-gradient-to-r", c.glow)}
            style={{ width: `${Math.min(100, Math.max(3, c.progress * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function StatsCards({ stats }: { stats: DashboardStats }) {
  const complianceDisplay =
    stats.avgComplianceScore != null ? `${Math.round(stats.avgComplianceScore)}%` : "—";

  const complianceColor =
    stats.avgComplianceScore == null
      ? "text-slate-400 dark:text-slate-500"
      : stats.avgComplianceScore >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : stats.avgComplianceScore >= 60
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  const cards: CardConfig[] = [
    {
      title: "Active Tenders",
      value: stats.activeTenders,
      subtitle: `${stats.totalTenders} total all-time`,
      icon: FolderOpen,
      grad: "from-blue-500 to-blue-600",
      shadow: "shadow-blue-500/30",
      glow: "from-blue-400 to-cyan-400",
    },
    {
      title: "Avg Compliance Score",
      value: complianceDisplay,
      subtitle: "Across active tenders",
      icon: ShieldCheck,
      grad: "from-emerald-500 to-teal-600",
      shadow: "shadow-emerald-500/30",
      glow: "from-emerald-400 to-teal-400",
      valueColor: complianceColor,
    },
    {
      title: "Proposals This Month",
      value: stats.proposalsThisMonth,
      subtitle: "Technical proposals drafted",
      icon: FileText,
      grad: "from-violet-500 to-fuchsia-600",
      shadow: "shadow-violet-500/30",
      glow: "from-violet-400 to-fuchsia-400",
    },
    {
      title: "AI Generations Used",
      value: stats.aiCreditsUsed,
      subtitle: `of ${stats.aiCreditsLimit} this month`,
      icon: Zap,
      grad: "from-amber-500 to-orange-600",
      shadow: "shadow-amber-500/30",
      glow: "from-amber-400 to-orange-400",
      progress: stats.aiCreditsLimit > 0 ? stats.aiCreditsUsed / stats.aiCreditsLimit : 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <StatCard key={c.title} c={c} />
      ))}
    </div>
  );
}
