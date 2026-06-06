import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext, hasRole } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { PLAN_LIMITS } from "@/lib/constants";
import { formatBytes } from "@/lib/utils";
import { isBillingEnabled } from "@/lib/billing/stripe";
import { BillingActions } from "@/components/settings/billing-actions";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, CreditCard, Zap, HardDrive, Users } from "lucide-react";

export const metadata = { title: "Billing" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const { org, member } = await getAuthContext();
  const { success, canceled } = await searchParams;

  const subscription = await db.subscription.findUnique({
    where: { orgId: org.id },
  });

  const plan = subscription?.planTier ?? "STARTER";
  const limits = PLAN_LIMITS[plan];

  const memberCount = await db.member.count({
    where: { orgId: org.id, isActive: true, deletedAt: null },
  });

  const canManage = hasRole(member.role, "ADMIN");
  const hasPaidSub = Boolean(subscription?.stripeCustomerId);
  const billingEnabled = isBillingEnabled();

  return (
    <>
      <PageHeader
        title="Billing & Plan"
        description="Manage your subscription and usage"
      />

      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {/* Post-checkout banners */}
        {success && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>
              Payment successful — your plan is now active. It may take a few
              seconds to reflect below.
            </span>
          </div>
        )}
        {canceled && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            <XCircle className="h-5 w-5 shrink-0" />
            <span>Checkout canceled — no changes were made to your plan.</span>
          </div>
        )}

        {/* Current plan — premium dark hero card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-[#0a1730] p-6 shadow-xl shadow-blue-900/20 sm:p-8">
          {/* Grid texture */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              maskImage: "radial-gradient(ellipse 80% 70% at 80% 0%, #000, transparent)",
              WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 80% 0%, #000, transparent)",
            }}
          />
          {/* Glow orb */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-50 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(59,130,246,0.5), transparent)" }}
          />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-blue-300">
                  Current Plan
                </span>
                {subscription?.isTrial && (
                  <Badge className="border-0 bg-blue-500/20 text-blue-200">Trial</Badge>
                )}
              </div>
              <h3 className="mt-2 text-3xl font-bold text-white">{limits.label}</h3>
              <p className="mt-1 text-sm text-slate-400">
                {limits.price === 0 ? (
                  "Custom enterprise pricing"
                ) : (
                  <>
                    <span className="bg-gradient-to-r from-white to-blue-200 bg-clip-text text-lg font-semibold text-transparent">
                      ${limits.price}
                    </span>
                    /month · billed {subscription?.billingCycle ?? "monthly"}
                  </>
                )}
              </p>
            </div>
            {subscription?.status && subscription.status !== "active" && (
              <Badge className="border-0 bg-amber-500/20 text-amber-200">
                {subscription.status === "past_due"
                  ? "Past due"
                  : subscription.status === "cancelled"
                  ? "Cancelled"
                  : subscription.status}
              </Badge>
            )}
          </div>

          {subscription?.currentPeriodEnd && (
            <p className="relative mt-6 text-xs text-slate-500">
              Current period ends:{" "}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </div>

        {/* Usage card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-5 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Usage this period
          </h3>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <UsageStat
              icon={<Users className="h-4 w-4 text-blue-500" />}
              label="Team Seats"
              used={memberCount}
              limit={limits.seats >= 999_999 ? null : limits.seats}
            />
            <UsageStat
              icon={<Zap className="h-4 w-4 text-amber-500" />}
              label="AI Credits"
              used={subscription?.aiCreditsUsed ?? 0}
              limit={limits.aiCreditsPerMonth >= 999_999 ? null : limits.aiCreditsPerMonth}
              suffix="/mo"
            />
            <UsageStat
              icon={<HardDrive className="h-4 w-4 text-violet-500" />}
              label="Storage"
              used={Number(subscription?.storageBytesUsed ?? 0)}
              limit={limits.storageBytesLimit}
              formatter={(n) => formatBytes(n)}
            />
            <UsageStat
              icon={<CreditCard className="h-4 w-4 text-emerald-500" />}
              label="Proposals"
              used={subscription?.proposalsUsed ?? 0}
              limit={limits.proposalsPerMonth >= 999_999 ? null : limits.proposalsPerMonth}
              suffix="/mo"
            />
          </div>
        </div>

        {/* Plan selection + Stripe customer portal */}
        <BillingActions
          currentTier={plan}
          hasPaidSub={hasPaidSub}
          canManage={canManage}
          billingEnabled={billingEnabled}
        />
      </div>
    </>
  );
}

function UsageStat({
  icon,
  label,
  used,
  limit,
  suffix = "",
  formatter,
}: {
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number | null;
  suffix?: string;
  formatter?: (n: number) => string;
}) {
  const display = formatter ? formatter(used) : used.toLocaleString();
  const limitDisplay = limit
    ? formatter
      ? formatter(limit)
      : limit.toLocaleString()
    : "∞";
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const isNearLimit = pct > 80;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <p
        className={`text-lg font-semibold tabular-nums ${isNearLimit ? "text-amber-600" : "text-slate-900 dark:text-slate-100"}`}
      >
        {display}
        {suffix && (
          <span className="ml-0.5 text-xs font-normal text-slate-400">
            {suffix}
          </span>
        )}
      </p>
      <p className="text-xs text-slate-400">
        of {limitDisplay}
        {suffix}
      </p>
      {limit && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${
              isNearLimit
                ? "from-amber-400 to-amber-500"
                : "from-blue-500 to-cyan-400"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
