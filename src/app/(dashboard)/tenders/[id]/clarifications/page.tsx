import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ClarificationsPanel } from "@/components/tenders/clarifications-panel";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/prisma";

export const metadata = { title: "Clarification Questions" };

export default async function ClarificationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { org } = await getAuthContext();
  const { id: tenderId } = await params;

  const tender = await db.tender.findFirst({
    where: { id: tenderId, orgId: org.id, deletedAt: null },
    select: { id: true, titleEn: true },
  });
  if (!tender) notFound();

  // Load latest clarification job result if exists
  const latestJob = await db.aIJob.findFirst({
    where: { orgId: org.id, resourceId: tenderId, jobType: "CLARIFICATION_QUESTIONS", status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    select: { id: true, resultRef: true, createdAt: true },
  });

  let questions: unknown[] = [];
  if (latestJob?.resultRef) {
    try {
      const parsed = JSON.parse(latestJob.resultRef);
      questions = parsed.questions ?? [];
    } catch {}
  }

  return (
    <>
      <PageHeader
        title="Clarification Questions"
        description="AI-generated RFI questions for submission to the client"
      />
      <div className="p-6">
        <ClarificationsPanel
          tenderId={tenderId}
          questions={questions as any}
          lastGeneratedAt={latestJob?.createdAt ?? null}
        />
      </div>
    </>
  );
}
