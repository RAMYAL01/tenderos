import Link from "next/link";
import { CheckSquare, ArrowRight, FolderOpen } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { cn } from "@/lib/utils";

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
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-24 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/25">
              <CheckSquare className="h-8 w-8" />
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
            {rows.map((t) => {
              const tone =
                t.pct >= 80
                  ? { text: "text-emerald-600 dark:text-emerald-400", bar: "from-emerald-500 to-teal-400", glow: "from-emerald-400 to-teal-400" }
                  : t.pct >= 50
                  ? { text: "text-blue-600 dark:text-blue-400", bar: "from-blue-500 to-cyan-400", glow: "from-blue-400 to-cyan-400" }
                  : { text: "text-amber-600 dark:text-amber-400", bar: "from-amber-500 to-orange-400", glow: "from-amber-400 to-orange-400" };
              return (
                <Link
                  key={t.id}
                  href={`/tenders/${t.id}/compliance`}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:shadow-none"
                >
                  <div
                    aria-hidden="true"
                    className={cn("pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition-opacity group-hover:opacity-40", tone.glow)}
                  />
                  <div className="relative mb-3 flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-600/25">
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    <span className={cn("text-2xl font-bold tabular-nums", tone.text)}>{t.pct}%</span>
                  </div>
                  <h3 className="relative line-clamp-1 font-semibold text-slate-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
                    {t.titleEn}
                  </h3>
                  {t.clientName && (
                    <p className="relative mt-0.5 line-clamp-1 text-xs text-slate-500">{t.clientName}</p>
                  )}

                  <div className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={cn("h-full rounded-full bg-gradient-to-r transition-all", tone.bar)}
                      style={{ width: `${t.pct}%` }}
                    />
                  </div>
                  <div className="relative mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{t._count.requirements} requirements</span>
                    <span className="inline-flex items-center">
                      {t.done}/{t.total} addressed
                      <ArrowRight className="ml-1 h-3 w-3 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                    </span>
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
