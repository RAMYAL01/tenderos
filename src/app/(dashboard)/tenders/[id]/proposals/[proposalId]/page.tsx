import { notFound } from "next/navigation";
import { getAuthContext, hasRole } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { ProposalEditor } from "@/components/proposals/proposal-editor";
import { ReviewBar, type ReviewTrailItem } from "@/components/proposals/review-bar";

export const metadata = { title: "Proposal Editor" };

export default async function ProposalEditorPage({
  params,
}: {
  params: Promise<{ id: string; proposalId: string }>;
}) {
  const { org, member } = await getAuthContext();
  const { id: tenderId, proposalId } = await params;

  const proposal = await db.proposal.findFirst({
    where: { id: proposalId, orgId: org.id, deletedAt: null },
    include: {
      sections: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
      },
      tender: {
        select: {
          id: true, titleEn: true, clientName: true, tenderType: true, primaryLanguage: true,
        },
      },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { versions: true } },
    },
  });

  if (!proposal || proposal.tender.id !== tenderId) notFound();

  // Approval trail (latest first) with actor names resolved org-scoped.
  const trailRows = await db.proposalReviewEvent.findMany({
    where: { proposalId, orgId: org.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const actorIds = [...new Set(trailRows.map((t) => t.actorId))];
  const actors = actorIds.length
    ? await db.member.findMany({
        where: { id: { in: actorIds }, orgId: org.id },
        select: { id: true, name: true },
      })
    : [];
  const actorName = new Map(actors.map((a) => [a.id, a.name]));
  const trail: ReviewTrailItem[] = trailRows.map((t) => ({
    id: t.id,
    action: t.action,
    note: t.note,
    actorName: actorName.get(t.actorId) ?? "Unknown",
    at: t.createdAt.toISOString(),
  }));

  // Load requirements with their compliance status for this proposal
  const complianceRows = await db.complianceMatrixRow.findMany({
    where: { tenderId },
    include: {
      requirement: {
        select: { id: true, textEn: true, priority: true, requirementType: true },
      },
    },
  });

  const requirements = complianceRows.map((row) => ({
    id: row.requirement.id,
    textEn: row.requirement.textEn,
    priority: row.requirement.priority,
    complianceStatus: row.status,
    sectionReference: row.sectionReference,
  }));

  const canEdit = hasRole(member.role, "WRITER");

  return (
    <>
      <ReviewBar
        proposalId={proposal.id}
        status={proposal.status}
        trail={trail}
        canSubmit={hasRole(member.role, "WRITER")}
        canReview={hasRole(member.role, "MANAGER")}
      />
      <ProposalEditor
      proposal={{
        id: proposal.id,
        title: proposal.title,
        language: proposal.language,
        status: proposal.status,
        currentVersion: proposal.currentVersion,
        complianceScore: proposal.complianceScore,
        tender: proposal.tender,
      }}
      sections={proposal.sections}
      requirements={requirements}
      canEdit={canEdit}
    />
    </>
  );
}
