import { format } from "date-fns";
import type { DashboardStats } from "@/lib/data/dashboard";

/**
 * Premium dashboard hero — gradient banner with greeting + inline highlight
 * metrics. Server component.
 */
export function DashboardHero({
  firstName,
  stats,
}: {
  firstName: string;
  stats: DashboardStats;
}) {
  const today = format(new Date(), "EEEE, d MMMM yyyy");
  const aiPct =
    stats.aiCreditsLimit > 0
      ? Math.min(100, Math.round((stats.aiCreditsUsed / stats.aiCreditsLimit) * 100))
      : 0;

  const highlights = [
    { label: "Active tenders", value: stats.activeTenders.toString() },
    { label: "Proposals this month", value: stats.proposalsThisMonth.toString() },
    { label: "AI credits used", value: `${aiPct}%` },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-[#0c1a35] to-[#0a1730] p-6 shadow-xl shadow-blue-950/30 sm:p-8">
      {/* Grid texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.10) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          maskImage: "radial-gradient(ellipse 70% 80% at 75% 0%, #000, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 80% at 75% 0%, #000, transparent)",
        }}
      />
      {/* Glow orb */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.55), transparent 70%)" }}
      />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">{today}</p>
          <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
            Good day, {firstName} <span className="inline-block">👋</span>
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-blue-100/70">
            Here&apos;s what&apos;s happening across your tender pipeline today.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {highlights.map((h) => (
            <div
              key={h.label}
              className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-sm"
            >
              <p className="text-xl font-bold tabular-nums text-white sm:text-2xl">{h.value}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-blue-200/70">{h.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
