import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { computeBreakdown } from "@/lib/financial/calculate";
import {
  buildOptimizationReport,
  type RequirementInput,
  type SectionInput,
  type FinancialInput,
} from "@/lib/optimization/score";
import { OptimizationDashboard } from "@/components/optimization/optimization-dashboard";

export const metadata = { title: "Bid Optimization" };

export default async function OptimizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { org } = await getAuthContext();
  const { id: tenderId } = await params;

  const tender = await db.tender.findFirst({
    where: { id: tenderId, orgId: org.id, deletedAt: null },
    select: { id: true, titleEn: true, currency: true, estimatedValue: true },
  });
  if (!tender) notFound();

  // ── Requirements + their compliance rows ──
  const requirements = await db.requirement.findMany({
    where: { tenderId, orgId: org.id, deletedAt: null },
    select: {
      id: true,
      textEn: true,
      textAr: true,
      requirementType: true,
      priority: true,
      complianceRow: {
        select: { status: true, responseEn: true, responseAr: true },
      },
    },
  });

  const reqInputs: RequirementInput[] = requirements.map((r) => ({
    id: r.id,
    textEn: r.textEn,
    textAr: r.textAr,
    requirementType: r.requirementType,
    priority: r.priority,
    complianceStatus: r.complianceRow?.status ?? null,
    hasResponse: Boolean(
      (r.complianceRow?.responseEn ?? "").trim() ||
        (r.complianceRow?.responseAr ?? "").trim()
    ),
  }));

  // ── Proposal sections (across all non-deleted proposals for this tender) ──
  const proposals = await db.proposal.findMany({
    where: { tenderId, orgId: org.id, deletedAt: null },
    select: {
      sections: {
        where: { deletedAt: null },
        select: { titleEn: true, contentEn: true, contentAr: true },
      },
    },
  });
  const sectionInputs: SectionInput[] = proposals.flatMap((p) => p.sections);

  // ── Financial proposal → deterministic breakdown ──
  const financial = await db.financialProposal.findFirst({
    where: { tenderId, orgId: org.id, deletedAt: null },
    include: { lines: true },
  });

  let financialInput: FinancialInput | null = null;
  if (financial) {
    const breakdown = computeBreakdown(
      financial.lines.map((l) => ({
        category: l.category,
        quantity: Number(l.quantity),
        unitRate: Number(l.unitRate),
      })),
      {
        overheadPct: Number(financial.overheadPct),
        contingencyPct: Number(financial.contingencyPct),
        profitMarginPct: Number(financial.profitMarginPct),
        vatPct: Number(financial.vatPct),
      }
    );
    financialInput = {
      netPrice: breakdown.netPrice,
      profitMarginPct: Number(financial.profitMarginPct),
      directCost: breakdown.directCost,
      estimatedValue: tender.estimatedValue ? Number(tender.estimatedValue) : null,
    };
  }

  // ── Org historical win/loss record (excluding this tender) ──
  const [won, lost] = await Promise.all([
    db.tender.count({ where: { orgId: org.id, status: "WON", deletedAt: null } }),
    db.tender.count({ where: { orgId: org.id, status: "LOST", deletedAt: null } }),
  ]);

  const report = buildOptimizationReport({
    requirements: reqInputs,
    sections: sectionInputs,
    financial: financialInput,
    history: { won, lost },
  });

  return (
    <>
      <PageHeader
        title="Bid Optimization"
        titleAr="تحسين العطاء"
        description="A deterministic read on bid health — win probability, compliance, pricing risk, and the gaps to close before you submit."
      />
      <div className="p-6">
        <OptimizationDashboard
          tenderId={tenderId}
          report={report}
          hasFinancial={Boolean(financial)}
        />
      </div>
    </>
  );
}
