import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext, hasRole } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { ComplianceMatrix } from "@/components/compliance/compliance-matrix";

export const metadata = { title: "Compliance Matrix" };

export default async function CompliancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { org, member } = await getAuthContext();
  const { id: tenderId } = await params;

  const tender = await db.tender.findFirst({
    where: { id: tenderId, orgId: org.id, deletedAt: null },
    select: { id: true, titleEn: true },
  });
  if (!tender) notFound();

  const rows = await db.complianceMatrixRow.findMany({
    where: { tenderId },
    include: {
      requirement: true,
      assignedTo: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: [
      { requirement: { priority: "asc" } },
      { requirement: { requirementType: "asc" } },
    ],
  });

  const score =
    rows.length > 0
      ? Math.round(
          (rows.filter((r) => r.status === "COMPLETED").length / rows.length) * 100
        )
      : 0;

  const canEdit = hasRole(member.role, "WRITER");

  return (
    <>
      <PageHeader
        title="Compliance Matrix"
        description={`${rows.length} requirements · ${score}% coverage`}
      />
      <div className="p-6">
        <ComplianceMatrix
          rows={rows as any}
          canEdit={canEdit}
          tenderId={tenderId}
        />
      </div>
    </>
  );
}
