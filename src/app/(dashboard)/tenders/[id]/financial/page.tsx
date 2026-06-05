import { notFound } from "next/navigation";
import { Calculator } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { FinancialBuilder } from "@/components/financial/financial-builder";
import { StartFinancialButton } from "@/components/financial/start-financial-button";
import { ExportFinancialButton } from "@/components/financial/export-financial-button";

export const metadata = { title: "Financial Proposal" };

export default async function FinancialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { org } = await getAuthContext();
  const { id: tenderId } = await params;

  const tender = await db.tender.findFirst({
    where: { id: tenderId, orgId: org.id, deletedAt: null },
    select: { id: true, titleEn: true, currency: true },
  });
  if (!tender) notFound();

  const financial = await db.financialProposal.findFirst({
    where: { tenderId, orgId: org.id, deletedAt: null },
    include: {
      lines: { orderBy: { orderIndex: "asc" } },
    },
  });

  return (
    <>
      <PageHeader
        title="Financial Proposal"
        description="Build a priced commercial proposal from your own rates — no AI pricing."
      >
        {financial && <ExportFinancialButton financialId={financial.id} />}
      </PageHeader>

      <div className="p-6">
        {!financial ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-20 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
              <Calculator className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Build your financial proposal
            </h3>
            <p className="mb-6 max-w-md text-sm text-slate-500">
              Enter your BOQ items, labor, equipment and material rates. TenderOS
              computes the full cost breakdown, markup, and total price
              deterministically — the AI never sets a price.
            </p>
            <StartFinancialButton tenderId={tenderId} />
          </div>
        ) : (
          <FinancialBuilder
            financialId={financial.id}
            currency={financial.currency}
            assumptions={{
              overheadPct: Number(financial.overheadPct),
              contingencyPct: Number(financial.contingencyPct),
              profitMarginPct: Number(financial.profitMarginPct),
              vatPct: Number(financial.vatPct),
            }}
            lines={financial.lines.map((l) => ({
              id: l.id,
              category: l.category,
              itemRef: l.itemRef,
              description: l.description,
              unit: l.unit,
              source: l.source,
              quantity: Number(l.quantity),
              unitRate: Number(l.unitRate),
            }))}
          />
        )}
      </div>
    </>
  );
}
