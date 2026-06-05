import Link from "next/link";
import { CheckSquare, ArrowRight, FolderOpen } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/prisma";

export const metadata = { title: "Compliance" };

export default async function CompliancePage() {
  const { org } = await getAuthContext();

  // Tenders that have requirements, with compliance-row status breakdown.
  const tenders = await db.tender.findMany({
    where: { orgId: org.id, deletedAt: null, requirements: { some: { deletedAt: null } } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      titleEn: true,
      clientName: true,
      _count: { select: { requirements: true, complianceRows: true } },
      complianceRows: { select: { status: true } },
    },
    take: 100,
  });

  const rows = tenders.map((t) => {
    const total = t.complianceRows.length;
    const done = t.complianceRows.filter((r) => r.status === "COMPLETED").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { ...t, total, done, pct };
  });

  return (
    <>
      <PageHeader
        title="Compliance"
        description="Track requirement coverage across all your tenders."
      />

      <div className="p-6">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-24 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <CheckSquare className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              No compliance matrices yet
            </h3>
            <p className="mb-6 max-w-sm text-sm text-slate-500">
              Upload an RFP and extract its requirements — a compliance matrix
              will be generated for each tender and tracked here.
            </p>
            <Button asChild>
              <Link href="/tenders">Go to Tenders</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((t) => (
              <Link
                key={t.id}
                href={`/tenders/${t.id}/compliance`}
                className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                    <FolderOpen className="h-4.5 w-4.5 text-blue-600" />
                  </div>
                  <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {t.pct}%
                  </span>
                </div>
                <h3 className="line-clamp-1 font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-100">
                  {t.titleEn}
                </h3>
                {t.clientName && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{t.clientName}</p>
                )}

                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
                    style={{ width: `${t.pct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{t._count.requirements} requirements</span>
                  <span>
                    {t.done}/{t.total} addressed
                    <ArrowRight className="ml-1 inline h-3 w-3 text-slate-300 transition-colors group-hover:text-slate-500" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
