import { notFound } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ExtractRequirementsButton } from "@/components/requirements/extract-requirements-button";
import { RequirementsTable } from "@/components/requirements/requirements-table";
import { GenerateComplianceButton } from "@/components/requirements/generate-compliance-button";
import { getAuthContext, hasRole } from "@/lib/auth";
import { db } from "@/lib/prisma";

export const metadata = { title: "Requirements" };

export default async function RequirementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { org, member } = await getAuthContext();
  const { id: tenderId } = await params;

  const tender = await db.tender.findFirst({
    where: { id: tenderId, orgId: org.id, deletedAt: null },
    select: { id: true, titleEn: true, status: true },
  });

  if (!tender) notFound();

  const [requirements, readyDocuments] = await Promise.all([
    db.requirement.findMany({
      where: { tenderId, deletedAt: null },
      orderBy: [
        { priority: "asc" },
        { requirementType: "asc" },
        { createdAt: "asc" },
      ],
    }),
    db.document.findMany({
      where: { tenderId, processingStatus: "READY", deletedAt: null },
      select: { id: true, originalFilename: true, languageDetected: true },
    }),
  ]);

  const canEdit = hasRole(member.role, "WRITER");
  const hasRequirements = requirements.length > 0;
  const hasComplianceRows = hasRequirements
    ? await db.complianceMatrixRow.count({ where: { tenderId, responseEn: { not: null } } }) > 0
    : false;

  return (
    <>
      <PageHeader
        title="Requirements"
        description={
          hasRequirements
            ? `${requirements.length} requirements extracted from tender documents`
            : "Extract requirements from your uploaded tender documents"
        }
      >
        <div className="flex items-center gap-2">
          {hasRequirements && canEdit && (
            <GenerateComplianceButton
              tenderId={tenderId}
              hasExistingCompliance={hasComplianceRows}
            />
          )}
          {canEdit && (
            <ExtractRequirementsButton
              tenderId={tenderId}
              documentIds={readyDocuments.map((d) => d.id)}
              hasExistingRequirements={hasRequirements}
            />
          )}
        </div>
      </PageHeader>

      <div className="p-6">
        {/* Documents status note */}
        {readyDocuments.length === 0 && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/10 dark:text-amber-400">
            <strong>No processed documents found.</strong>{" "}
            <a href={`/tenders/${tenderId}`} className="underline">
              Upload and process a document
            </a>{" "}
            first, then come back to extract requirements.
          </div>
        )}

        {readyDocuments.length > 0 && !hasRequirements && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-6 py-8 text-center dark:border-blue-900/50 dark:bg-blue-900/10">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-blue-500" />
            <h3 className="mb-1 font-semibold text-slate-900 dark:text-slate-100">
              Ready to extract requirements
            </h3>
            <p className="mb-5 text-sm text-slate-600 dark:text-slate-400">
              {readyDocuments.length} document{readyDocuments.length > 1 ? "s" : ""} ready.
              Claude will analyze{" "}
              {readyDocuments.map((d) => `"${d.originalFilename}"`).join(", ")}{" "}
              and extract all mandatory and optional requirements.
            </p>
            <ExtractRequirementsButton
              tenderId={tenderId}
              documentIds={readyDocuments.map((d) => d.id)}
              hasExistingRequirements={false}
            />
          </div>
        )}

        {/* Requirements table */}
        <RequirementsTable requirements={requirements} canEdit={canEdit} />
      </div>
    </>
  );
}
