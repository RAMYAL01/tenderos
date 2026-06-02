import { notFound } from "next/navigation";
import { getAuthContext, hasRole } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { ProposalEditor } from "@/components/proposals/proposal-editor";

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
  );
}
