import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Tenders" };

/**
 * Tenders list page — full implementation in Step 5.
 * This placeholder gives working navigation.
 */
export default function TendersPage() {
  return (
    <>
      <PageHeader
        title="Tenders"
        titleAr="المناقصات"
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

      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          No tenders yet
        </h3>
        <p className="mb-6 max-w-sm text-sm text-slate-500">
          Create your first tender to upload RFP documents, extract requirements,
          and start building your technical proposal.
        </p>
        <Button asChild>
          <Link href="/tenders/new">
            <Plus className="mr-2 h-4 w-4" />
            Create First Tender
          </Link>
        </Button>
      </div>
    </>
  );
}
