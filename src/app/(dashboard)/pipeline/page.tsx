import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getAuthContext, hasRole } from "@/lib/auth";
import { getPipeline } from "@/lib/data/pipeline";
import { PipelineBoard, PipelineSummary } from "@/components/pipeline/pipeline-board";

export const metadata = { title: "Pipeline" };

/**
 * Capture Pipeline — the operating view of the whole bid lifecycle.
 * Columns derive from Tender.status (no parallel state machine); the
 * Discovered rail surfaces saved-but-unconverted opportunities so the
 * top of the funnel lives on the same board as the work.
 */
async function PipelineContent() {
  const { org, member } = await getAuthContext();
  const data = await getPipeline(org.id);

  return (
    <>
      <div className="border-b border-slate-200/70 px-6 py-3 dark:border-slate-800/70">
        <PipelineSummary data={data} />
      </div>
      <PipelineBoard
        data={data}
        canMove={hasRole(member.role, "WRITER")}
        canDecide={hasRole(member.role, "MANAGER")}
      />
    </>
  );
}

export default function PipelinePage() {
  return (
    <>
      <PageHeader
        title="Pipeline"
        titleAr="مسار العطاءات"
        description="Every bid, from discovery to decision — in one operating view."
      />
      <Suspense fallback={<PageSkeleton />}>
        <PipelineContent />
      </Suspense>
    </>
  );
}
