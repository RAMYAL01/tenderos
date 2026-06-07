import Link from "next/link";
import { FileText, ArrowRight, Plus, Layers, Globe, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { PROPOSAL_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata = { title: "Proposals" };

const STATUS_STYLES: Record<string, { pill: string; dot: string }> = {
  DRAFT: { pill: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", dot: "bg-slate-400" },
  IN_REVIEW: { pill: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300", dot: "bg-blue-500" },
  CHANGES_REQUESTED: { pill: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300", dot: "bg-amber-500" },
  APPROVED: { pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300", dot: "bg-emerald-500" },
  EXPORTED: { pill: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300", dot: "bg-violet-500" },
  ARCHIVED: { pill: "bg-slate-100 text-slate-400", dot: "bg-slate-300" },
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
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-24 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-600/25">
              <FileText className="h-8 w-8" />
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
          <div className="flex flex-col gap-3">
            {proposals.map((p) => {
              const s = STATUS_STYLES[p.status] ?? STATUS_STYLES.DRAFT;
              const score = p.complianceScore != null ? Math.round(p.complianceScore) : null;
              return (
                <Link
                  key={p.id}
                  href={`/tenders/${p.tender.id}/proposals/${p.id}`}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:shadow-none"
                >
                  <span className={cn("absolute inset-y-0 left-0 w-1", s.dot)} />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1 pl-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", s.pill)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                          {PROPOSAL_STATUS_LABELS[p.status]}
                        </span>
                        <span className="text-xs text-slate-400">v{p.currentVersion}</span>
                      </div>
                      <h3 className="mt-2 truncate text-base font-semibold text-slate-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
                        {p.title}
                      </h3>
                      <p className="mt-1 truncate text-xs text-slate-500">{p.tender.titleEn}</p>
                    </div>

                    <div className="flex items-center gap-5 pl-2 sm:pl-0">
                      <Metric icon={Layers} value={`${p._count.sections}`} label="sections" />
                      <Metric icon={Globe} value={p.language} label="lang" />
                      {score != null && (
                        <Metric
                          icon={ShieldCheck}
                          value={`${score}%`}
                          label="compliance"
                          valueClass={
                            score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600"
                          }
                        />
                      )}
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
  valueClass,
}: {
  icon: React.ElementType;
  value: string;
  label: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className={cn("flex items-center gap-1 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200", valueClass)}>
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
    </div>
  );
}
