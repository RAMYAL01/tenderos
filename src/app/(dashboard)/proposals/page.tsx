import Link from "next/link";
import { FileText, ArrowRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { PROPOSAL_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata = { title: "Proposals" };

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  IN_REVIEW: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  CHANGES_REQUESTED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  EXPORTED: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  ARCHIVED: "bg-slate-100 text-slate-400",
};

export default async function ProposalsPage() {
  const { org } = await getAuthContext();

  const proposals = await db.proposal.findMany({
    where: { orgId: org.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      language: true,
      currentVersion: true,
      complianceScore: true,
      updatedAt: true,
      tender: { select: { id: true, titleEn: true } },
      _count: { select: { sections: true } },
    },
    take: 100,
  });

  return (
    <>
      <PageHeader
        title="Proposals"
        titleAr="العروض الفنية"
        description="All technical proposals across your tenders."
      >
        <Button size="sm" asChild>
          <Link href="/tenders">
            <Plus className="mr-2 h-4 w-4" />
            New from Tender
          </Link>
        </Button>
      </PageHeader>

      <div className="p-6">
        {proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-24 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              No proposals yet
            </h3>
            <p className="mb-6 max-w-sm text-sm text-slate-500">
              Open a tender, extract its requirements, then create a technical
              proposal — it&apos;ll appear here.
            </p>
            <Button asChild>
              <Link href="/tenders">Go to Tenders</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Proposal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Status</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 lg:table-cell">Tender</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 xl:table-cell">Sections</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 sm:table-cell">Lang</th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {proposals.map((p) => (
                  <tr key={p.id} className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-900">
                    <td className="px-4 py-3">
                      <Link
                        href={`/tenders/${p.tender.id}/proposals/${p.id}`}
                        className="font-medium text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                      >
                        {p.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-400">v{p.currentVersion}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[p.status] ?? STATUS_STYLES.DRAFT)}>
                        {PROPOSAL_STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <Link href={`/tenders/${p.tender.id}`} className="line-clamp-1 text-xs text-slate-500 hover:text-blue-600">
                        {p.tender.titleEn}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-slate-500 xl:table-cell">{p._count.sections}</td>
                    <td className="hidden px-4 py-3 text-xs text-slate-500 sm:table-cell">{p.language}</td>
                    <td className="px-4 py-3">
                      <Link href={`/tenders/${p.tender.id}/proposals/${p.id}`}>
                        <ArrowRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
