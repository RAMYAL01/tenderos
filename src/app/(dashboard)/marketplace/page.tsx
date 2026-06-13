import Link from "next/link";
import { Suspense } from "react";
import { Handshake, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Button } from "@/components/ui/button";
import { getAuthContext, hasRole } from "@/lib/auth";
import { getDirectory, getMyProfile, getConnections } from "@/lib/data/marketplace";
import { MarketplaceSubnav } from "@/components/marketplace/marketplace-subnav";
import { DirectoryGrid } from "@/components/marketplace/directory-grid";

export const metadata = { title: "Marketplace" };

async function DirectoryContent() {
  const { org, member } = await getAuthContext();
  const [cards, myProfile, connections] = await Promise.all([
    getDirectory(org.id),
    getMyProfile(org.id),
    getConnections(org.id),
  ]);
  const incoming = connections.filter((c) => c.direction === "incoming" && c.status === "PENDING").length;
  const canConnect = hasRole(member.role, "MANAGER");
  const isAdmin = hasRole(member.role, "ADMIN");

  return (
    <>
      <MarketplaceSubnav incoming={incoming} />

      {!myProfile?.published && (
        <div className="mx-6 mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Your firm isn&apos;t listed yet.
            </p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300/80">
              Publish a profile so other contractors can find you for joint ventures and subcontracting — and so you can
              request connections of your own.
            </p>
          </div>
          {isAdmin && (
            <Button size="sm" asChild>
              <Link href="/marketplace/profile">Set up profile</Link>
            </Button>
          )}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-600/25">
            <Handshake className="h-8 w-8" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            The partner network is just getting started
          </h3>
          <p className="max-w-md text-sm text-slate-500">
            As contractors across the region publish their profiles, they&apos;ll appear here — searchable by sector,
            capability, and country for JV and subcontracting partnerships.
          </p>
        </div>
      ) : (
        <DirectoryGrid cards={cards} canConnect={canConnect} />
      )}
    </>
  );
}

export default function MarketplacePage() {
  return (
    <div>
      <PageHeader
        title="Marketplace"
        titleAr="السوق"
        description="Find partners for joint ventures and subcontracting across the region."
      />
      <Suspense fallback={<PageSkeleton rows={6} />}>
        <DirectoryContent />
      </Suspense>
    </div>
  );
}
