import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { generateFinancialDocx } from "@/lib/export/financial-docx";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/financial/[id]/export
 *
 * Streams a deterministically-priced Financial Proposal as a .docx download.
 * The id is the FinancialProposal id. Every figure in the file is computed by
 * the AI-free engine in src/lib/financial/calculate.ts.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const financial = await db.financialProposal.findFirst({
    where: { id, orgId: org.id, deletedAt: null },
    include: {
      lines: { orderBy: { orderIndex: "asc" } },
      tender: {
        select: {
          titleEn: true,
          titleAr: true,
          clientName: true,
          referenceNo: true,
          tenderType: true,
        },
      },
      organization: { select: { name: true } },
    },
  });

  if (!financial) {
    return NextResponse.json({ error: "Financial proposal not found" }, { status: 404 });
  }

  try {
    const buffer = await generateFinancialDocx({
      title: financial.title,
      currency: financial.currency,
      assumptions: {
        overheadPct: Number(financial.overheadPct),
        contingencyPct: Number(financial.contingencyPct),
        profitMarginPct: Number(financial.profitMarginPct),
        vatPct: Number(financial.vatPct),
      },
      lines: financial.lines.map((l) => ({
        category: l.category,
        itemRef: l.itemRef,
        description: l.description,
        unit: l.unit,
        quantity: Number(l.quantity),
        unitRate: Number(l.unitRate),
        source: l.source,
      })),
      tender: {
        titleEn: financial.tender.titleEn,
        titleAr: financial.tender.titleAr,
        clientName: financial.tender.clientName,
        referenceNo: financial.tender.referenceNo,
        tenderType: financial.tender.tenderType,
      },
      companyName: financial.organization?.name ?? undefined,
      exportedAt: new Date().toISOString(),
    });

    const safeTitle = (financial.tender.titleEn || "financial-proposal")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 60);
    const filename = `Financial_Proposal_${safeTitle}.docx`;

    // Mark as exported (best-effort).
    await db.financialProposal
      .update({ where: { id }, data: { status: "EXPORTED" } })
      .catch(() => {});

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[financial-export] DOCX generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
