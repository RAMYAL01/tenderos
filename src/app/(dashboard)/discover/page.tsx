import { Suspense } from "react";
import { after } from "next/server";
import { Compass } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { getDiscoverFeed, catalogHasOpportunities } from "@/lib/data/opportunities";
import { getSavedSearches } from "@/lib/data/saved-searches";
import { canUseScheduledDiscovery } from "@/lib/billing/quota";
import { DiscoverList } from "@/components/discovery/discover-list";
import { DiscoverScanCta } from "@/components/discovery/discover-scan-cta";

export const metadata = { title: "Discover" };

async function DiscoverContent() {
  const { org } = await getAuthContext();
  // PURE READ — never triggers matching on render (matching is the scan action).
  const [feed, savedSearches] = await Promise.all([
    getDiscoverFeed(org.id),
    getSavedSearches(org.id),
  ]);

  // Viewing the feed consumes the unread digests (clears bell + nav badge).
  // after() = post-response, so the render itself stays a pure read.
  after(async () => {
    await db.opportunityAlert
      .updateMany({
        where: { orgId: org.id, channel: "IN_APP", readAt: null },
        data: { readAt: new Date() },
      })
      .catch(() => {});
  });

  if (feed.length === 0) {
    const hasCatalog = await catalogHasOpportunities();
    return (
      <div className="flex flex-col items-center justify-center px-6 py-28 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-600/25">
          <Compass className="h-8 w-8" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          {hasCatalog ? "Find tenders matched to your company" : "No live opportunities yet"}
        </h3>
        <p className="mb-6 max-w-md text-sm text-slate-500">
          {hasCatalog
            ? "We'll score open government and infrastructure tenders against your company profile and the work you win, then rank the best fits for you."
            : "We're connecting tender sources for your region. Check back soon — matched opportunities will appear here automatically."}
        </p>
        {hasCatalog && <DiscoverScanCta />}
      </div>
    );
  }

  return (
    <DiscoverList
      items={feed}
      savedSearches={savedSearches}
      canScheduleAlerts={canUseScheduledDiscovery(org.planTier)}
    />
  );
}

export default function DiscoverPage() {
  return (
    <>
      <PageHeader
        title="Discover"
        titleAr="اكتشف"
        description="Government & infrastructure tenders, ranked for your company."
      />
      <Suspense fallback={<PageSkeleton />}>
        <DiscoverContent />
      </Suspense>
    </>
  );
}
