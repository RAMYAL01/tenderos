import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { getBillingLock } from "@/lib/billing/quota";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BillingLockGate } from "@/components/billing/billing-lock-gate";
import { WorkspaceProvider } from "@/components/providers/workspace-provider";
import { AnalyticsIdentify } from "@/components/providers/analytics-identify";
import { PLAN_LIMITS } from "@/lib/constants";

/**
 * Dashboard layout — server component.
 *
 * - Authenticates user via Clerk + syncs to our DB
 * - Provides org + member context to all child components
 * - Renders sidebar + header shell
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This validates auth, fetches org + member from DB,
  // and redirects to /sign-in if anything is wrong.
  const { org, member } = await getAuthContext();

  // Org-first gate: a workspace must finish the onboarding wizard before the
  // dashboard is usable. Existing workspaces were backfilled, so only brand-new
  // companies are routed here.
  if (!org.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  // Billing gate: expired trial / unpaid subscription locks the app shell
  // (settings stay reachable so billing can be fixed — see BillingLockGate).
  const [billing, unreadDiscovery] = await Promise.all([
    getBillingLock(org.id),
    // Unread discovery digests → "new opportunities" badge on the Discover nav.
    db.opportunityAlert.count({
      where: { orgId: org.id, channel: "IN_APP", status: "SENT", readAt: null },
    }),
  ]);

  return (
    <WorkspaceProvider org={org} member={member}>
      <AnalyticsIdentify
        userId={member.clerkUserId}
        organizationId={org.id}
        organizationName={org.name}
        plan={PLAN_LIMITS[org.planTier]?.label ?? org.planTier}
        role={member.role}
      />
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Sidebar — fixed left panel */}
        <Sidebar member={member} org={org} discoverBadge={unreadDiscovery} />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />

          {/* Scrollable content */}
          <main className="flex flex-1 flex-col overflow-y-auto">
            <BillingLockGate locked={billing.locked} reason={billing.reason}>
              {children}
            </BillingLockGate>
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
