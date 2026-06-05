import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Plus, FileText, Sparkles, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { CreateProposalDialog } from "@/components/proposals/create-proposal-dialog";
import { getAuthContext, hasRole } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata = { title: "Proposals" };

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  EXPORTED: "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-slate-100 text-slate-400",
};

const LANG_FLAGS: Record<string, string> = {
  EN: "🇬🇧", AR: "🇸🇦", AR_SA: "🇸🇦", AR_AE: "🇦🇪", AR_EG: "🇪🇬", BILINGUAL: "🌐",
};

export default async function ProposalsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { org, member } = await getAuthContext();
  const { id: tenderId } = await params;

  const tender = await db.tender.findFirst({
    where: { id: tenderId, orgId: org.id, deletedAt: null },
    select: { id: true, titleEn: true, primaryLanguage: true },
  });
  if (!tender) notFound();

  const proposals = await db.proposal.findMany({
    where: { tenderId, orgId: org.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      _count: {
        select: {
          sections: { where: { deletedAt: null } },
          versions: true,
          comments: { where: { deletedAt: null } },
        },
      },
    },
  });

  const canCreate = hasRole(member.role, "WRITER");

  return (
    <>
      <PageHeader
        title="Proposals"
        description={`${proposals.length} proposal${proposals.length === 1 ? "" : "s"} for this tender`}
      >
        {canCreate && (
          <CreateProposalDialog
            tenderId={tenderId}
            defaultLanguage={tender.primaryLanguage}
          />
        )}
      </PageHeader>

      <div className="p-6">
        {proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-20 text-center dark:border-slate-700">
            <FileText className="mb-3 h-12 w-12 text-slate-300" />
            <h3 className="mb-1 font-semibold text-slate-700 dark:text-slate-300">
              No proposals yet
            </h3>
            <p className="mb-6 max-w-sm text-sm text-slate-500">
              Create a technical proposal and use AI to draft each section in English, Arabic, or both.
            </p>
            {canCreate && (
              <CreateProposalDialog
                tenderId={tenderId}
                defaultLanguage={tender.primaryLanguage}
                trigger={
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create First Proposal
                  </Button>
                }
              />
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {proposals.map((proposal) => {
              const sectionsWithContent = proposal._count.sections;
              return (
                <div
                  key={proposal.id}
                  className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-medium text-slate-900 dark:text-slate-100">
                        {proposal.title}
                      </p>
                    </div>
                    <span className="text-lg" title={proposal.language}>
                      {LANG_FLAGS[proposal.language] ?? "🌐"}
                    </span>
                  </div>

                  {/* Status + meta */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[proposal.status])}>
                      {proposal.status.replace("_", " ")}
                    </span>
                    <span className="text-xs text-slate-500">
                      {sectionsWithContent} sections
                    </span>
                    <span className="text-xs text-slate-500">
                      v{proposal.currentVersion}
                    </span>
                    {proposal.complianceScore != null && (
                      <span className={cn(
                        "text-xs font-medium",
                        proposal.complianceScore >= 80 ? "text-emerald-600" : "text-amber-600"
                      )}>
                        {Math.round(proposal.complianceScore)}% compliant
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                    <span className="text-xs text-slate-400">
                      {format(new Date(proposal.updatedAt), "d MMM yyyy")}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        asChild
                      >
                        <Link
                          href={`/tenders/${tenderId}/proposals/${proposal.id}/preview`}
                          target="_blank"
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          Preview
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        asChild
                      >
                        <Link href={`/tenders/${tenderId}/proposals/${proposal.id}`}>
                          <Sparkles className="mr-1 h-3 w-3" />
                          Edit
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
