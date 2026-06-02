import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { PLAN_LIMITS } from "@/lib/constants";
import { formatBytes } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Zap, HardDrive, Users, ArrowUpRight } from "lucide-react";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const { org } = await getAuthContext();

  const subscription = await db.subscription.findUnique({
    where: { orgId: org.id },
  });

  const plan = subscription?.planTier ?? "STARTER";
  const limits = PLAN_LIMITS[plan];

  const memberCount = await db.member.count({
    where: { orgId: org.id, isActive: true, deletedAt: null },
  });

  return (
    <>
      <PageHeader
        title="Billing & Plan"
        description="Manage your subscription and usage"
      />

      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {/* Current plan */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  Current Plan
                </h3>
                <Badge variant="secondary">{limits.label}</Badge>
                {subscription?.isTrial && (
                  <Badge className="bg-blue-100 text-blue-700">Trial</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {limits.price === 0
                  ? "Custom enterprise pricing"
                  : `$${limits.price}/month · billed ${subscription?.billingCycle ?? "monthly"}`}
              </p>
            </div>
            <Button className="gap-2">
              <ArrowUpRight className="h-4 w-4" />
              Upgrade Plan
            </Button>
          </div>

          {/* Usage grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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

          {subscription?.currentPeriodEnd && (
            <p className="mt-4 text-xs text-slate-400">
              Current period ends:{" "}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString(
                "en-US",
                { month: "long", day: "numeric", year: "numeric" }
              )}
            </p>
          )}
        </div>

        {/* Stripe portal placeholder */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <strong>Billing management</strong> via Stripe Customer Portal is
            configured in Phase 2. Contact{" "}
            <a
              href="mailto:billing@tenderos.ai"
              className="text-blue-600 hover:underline"
            >
              billing@tenderos.ai
            </a>{" "}
            to upgrade, cancel, or request an invoice.
          </p>
        </div>
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
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className={`h-full rounded-full transition-all ${isNearLimit ? "bg-amber-500" : "bg-blue-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
