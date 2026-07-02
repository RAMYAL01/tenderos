import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

/**
 * Read-only operator trace for the Autonomous Bid Agent (#6).
 *
 * Given a tenderId, returns the live state of that tender's BidWorkflow — the
 * durable status/step/error, the per-step AIJob progress, the document readiness,
 * and counts of what the run has produced so far (requirements, compliance rows,
 * bid decision, drafted proposal sections). PURE READ — no writes, no side effects,
 * no triggering. Scoped to a single caller-supplied tenderId (no cross-tenant list).
 *
 * Secured by CRON_SECRET (operator data, not tenant UI):
 *   curl -H "Authorization: Bearer $CRON_SECRET" ".../api/ops/bid-agent?tenderId=<id>"
 */

export const dynamic = "force-dynamic";

const STEP_JOBS = ["EXTRACT_REQUIREMENTS", "GENERATE_COMPLIANCE_MATRIX", "BID_QUALIFICATION"] as const;

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenderId = new URL(req.url).searchParams.get("tenderId");
  if (!tenderId) {
    return NextResponse.json({ error: "tenderId query param required" }, { status: 400 });
  }

  const [totalDocs, readyDocs, workflow, steps, requirements, complianceRows, bidDecision, proposal] =
    await Promise.all([
      db.document.count({ where: { tenderId, deletedAt: null } }),
      db.document.count({ where: { tenderId, deletedAt: null, processingStatus: "READY" } }),
      db.bidWorkflow.findFirst({
        where: { tenderId },
        orderBy: { updatedAt: "desc" },
        select: {
          status: true, failedStep: true, error: true, attempts: true,
          startedAt: true, updatedAt: true, completedAt: true, result: true,
        },
      }),
      db.aIJob.findMany({
        where: { resourceId: tenderId, jobType: { in: [...STEP_JOBS] } },
        orderBy: { createdAt: "asc" },
        select: { jobType: true, status: true, progress: true, errorMessage: true, updatedAt: true },
      }),
      db.requirement.count({ where: { tenderId, deletedAt: null } }),
      db.complianceMatrixRow.count({ where: { tenderId } }),
      db.bidDecision.findUnique({ where: { tenderId }, select: { recommendation: true, score: true } }),
      db.proposal.findFirst({
        where: { tenderId, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, sections: { where: { deletedAt: null }, select: { contentEn: true, contentAr: true } } },
      }),
    ]);

  const draftedSections = proposal
    ? proposal.sections.filter((s) => (s.contentEn?.trim().length ?? 0) > 0 || (s.contentAr?.trim().length ?? 0) > 0).length
    : 0;

  return NextResponse.json({
    tenderId,
    documents: { total: totalDocs, ready: readyDocs, runnable: readyDocs > 0 },
    workflow: workflow ?? null,
    steps,
    artifacts: {
      requirements,
      complianceRows,
      bidDecision: bidDecision ?? null,
      proposal: proposal ? { id: proposal.id, totalSections: proposal.sections.length, draftedSections } : null,
    },
  });
}
