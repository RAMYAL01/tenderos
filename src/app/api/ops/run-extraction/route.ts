import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { runExtractionAgent } from "@/lib/ai/agents/extract-requirements";

/**
 * Operator-triggered requirement extraction — runs the agent AWAITED, in-region,
 * so we can prove it completes when the function stays alive (vs. the after()
 * freeze that stalled it at 10%). Also does the real work: extracts the tender's
 * requirements. Secured by CRON_SECRET.
 */
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenderId = new URL(req.url).searchParams.get("tenderId");
  if (!tenderId) return NextResponse.json({ error: "tenderId query param required" }, { status: 400 });

  const tender = await db.tender.findUnique({ where: { id: tenderId }, select: { orgId: true } });
  if (!tender) return NextResponse.json({ error: "Tender not found" }, { status: 404 });
  const orgId = tender.orgId;

  const docs = await db.document.findMany({
    where: { tenderId, processingStatus: "READY", deletedAt: null },
    select: { id: true },
  });
  if (docs.length === 0) return NextResponse.json({ error: "No READY documents for this tender" }, { status: 400 });

  const job = await db.aIJob.create({
    data: {
      orgId,
      jobType: "EXTRACT_REQUIREMENTS",
      resourceType: "tender",
      resourceId: tenderId,
      status: "QUEUED",
      progress: 0,
      inputMetadata: { tenderId, opsTriggered: true },
    },
  });

  const t0 = Date.now();
  let caught: string | null = null;
  try {
    await runExtractionAgent(job.id, tenderId, docs.map((d) => d.id), orgId);
  } catch (e) {
    caught = e instanceof Error ? e.message : String(e);
  }

  const finalJob = await db.aIJob.findUnique({
    where: { id: job.id },
    select: { status: true, progress: true, errorMessage: true, totalTokens: true, latencyMs: true },
  });
  const requirements = await db.requirement.count({ where: { tenderId, orgId, deletedAt: null } });
  const complianceRows = await db.complianceMatrixRow.count({ where: { tenderId, orgId } });

  return NextResponse.json({
    jobId: job.id,
    elapsedMs: Date.now() - t0,
    job: finalJob,
    requirements,
    complianceRows,
    caughtError: caught,
  });
}
