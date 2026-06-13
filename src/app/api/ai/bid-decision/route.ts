import { auth } from "@clerk/nextjs/server";
import { NextResponse, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { checkAndConsumeAiCredit } from "@/lib/billing/quota";
import { runBidQualifierAgent } from "@/lib/ai/agents/bid-qualifier";
import { track, apiContext } from "@/lib/analytics/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const maxDuration = 120;

const RequestSchema = z.object({ tenderId: z.string().min(1) });

/**
 * POST /api/ai/bid-decision
 * Runs the Bid/No-Bid qualification for a tender (deterministic factors +
 * bounded LLM qualitative layer). Returns 202 + jobId; client polls
 * /api/ai/jobs/[id]. Re-running replaces the previous analysis.
 */
export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { tenderId } = parsed.data;

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await db.member.findFirst({
    where: { clerkUserId: userId, orgId: org.id, isActive: true, deletedAt: null },
  });
  if (!member || !hasRole(member.role, "WRITER")) {
    return NextResponse.json({ error: "Requires Writer role or higher" }, { status: 403 });
  }

  const tender = await db.tender.findFirst({
    where: { id: tenderId, orgId: org.id, deletedAt: null },
    select: { id: true },
  });
  if (!tender) return NextResponse.json({ error: "Tender not found" }, { status: 404 });

  // Plan limit: one AI credit per qualification run.
  const quota = await checkAndConsumeAiCredit(org.id);
  if (!quota.ok) {
    after(() => track(ANALYTICS_EVENTS.PLAN_LIMIT_REACHED, apiContext({ userId, org, role: member.role }), { limit_type: "ai_credit" }));
    return NextResponse.json({ error: quota.error, code: quota.code }, { status: 402 });
  }

  const job = await db.aIJob.create({
    data: {
      orgId: org.id,
      memberId: member.id,
      jobType: "BID_QUALIFICATION",
      resourceType: "tender",
      resourceId: tenderId,
      status: "QUEUED",
      progress: 0,
      inputMetadata: { tenderId },
    },
  });

  after(async () => {
    try {
      await runBidQualifierAgent(job.id, tenderId, org.id, member.id);
      const decision = await db.bidDecision.findUnique({
        where: { tenderId },
        select: { recommendation: true, score: true, confidence: true },
      });
      await track(ANALYTICS_EVENTS.BID_SCORE_GENERATED, apiContext({ userId, org, role: member.role }), {
        recommendation: decision?.recommendation,
        score: decision?.score,
        confidence: decision?.confidence,
      });
    } catch (err) {
      console.error("[bid-decision] agent failed:", err);
      await db.aIJob
        .update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorMessage: err instanceof Error ? err.message : "Qualification failed",
          },
        })
        .catch(() => {});
    }
  });

  return NextResponse.json({ jobId: job.id, status: "QUEUED" }, { status: 202 });
}
