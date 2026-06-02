import { Suspense } from "react";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentTenders } from "@/components/dashboard/recent-tenders";
import { UpcomingDeadlines } from "@/components/dashboard/upcoming-deadlines";
import { getAuthContext } from "@/lib/auth";
import {
  getDashboardStats,
  getRecentTenders,
  getUpcomingDeadlines,
} from "@/lib/data/dashboard";

export const metadata = { title: "Dashboard" };

// Separate async component for the main content
// so we can wrap it in Suspense with a skeleton
async function DashboardContent() {
  const { org, member } = await getAuthContext();

  const [stats, recentTenders, upcomingDeadlines] = await Promise.all([
    getDashboardStats(org.id),
    getRecentTenders(org.id, 8),
    getUpcomingDeadlines(org.id, 5),
  ]);

  const firstName = member.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Welcome banner */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Good day, {firstName} 👋
        </h2>
        <p className="text-sm text-slate-500">
          Here&apos;s what&apos;s happening with your tenders today.
        </p>
      </div>

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Main grid: recent tenders + deadlines */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Recent tenders — takes 2/3 of the width */}
        <div className="xl:col-span-2">
          <RecentTenders tenders={recentTenders} />
        </div>

        {/* Upcoming deadlines — takes 1/3 */}
        <UpcomingDeadlines deadlines={upcomingDeadlines} />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-xl xl:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      {/* Page header with action buttons */}
      <PageHeader
        title="Dashboard"
        description="Your tender pipeline at a glance"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/tenders/new?step=upload">
            <Upload className="mr-2 h-4 w-4" />
            Upload RFP
          </Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/tenders/new">
            <Plus className="mr-2 h-4 w-4" />
            New Tender
          </Link>
        </Button>
      </PageHeader>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}
