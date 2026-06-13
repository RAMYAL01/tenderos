import { Suspense } from "react";
import Link from "next/link";
import { Plus, Upload, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuthContext } from "@/lib/auth";
import { getAllTenders } from "@/lib/data/tenders";
import { TendersList } from "@/components/tenders/tenders-list";
import { TrySampleTenderButton } from "@/components/demo/try-sample-button";

export const metadata = { title: "Tenders" };

async function TendersContent() {
  const { org } = await getAuthContext();
  const tenders = await getAllTenders(org.id);

  if (tenders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-600/25">
          <FolderOpen className="h-8 w-8" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          No tenders yet
        </h3>
        <p className="mb-6 max-w-sm text-sm text-slate-500">
          Create your first tender to upload RFP documents, extract requirements,
          and start building your technical proposal.
        </p>
        <div className="flex flex-col items-center gap-3">
          <Button asChild>
            <Link href="/tenders/new">
              <Plus className="mr-2 h-4 w-4" />
              Create First Tender
            </Link>
          </Button>
          <span className="text-xs uppercase tracking-wide text-slate-400">or</span>
          <TrySampleTenderButton variant="outline" label="Try a sample tender — no upload" />
        </div>
      </div>
    );
  }

  return <TendersList tenders={tenders} />;
}

function TendersSkeleton() {
  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-80 rounded-lg" />
        <Skeleton className="h-9 w-72 rounded-lg" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  );
}

export default function TendersPage() {
  return (
    <>
      <PageHeader
        title="Tenders"
        description="Manage all your bid projects and RFP responses."
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

      <Suspense fallback={<TendersSkeleton />}>
        <TendersContent />
      </Suspense>
    </>
  );
}
