import { auth } from "@clerk/nextjs/server";
import { NextResponse, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { checkAndConsumeAiCredit } from "@/lib/billing/quota";
import { runCommercialModelAgent } from "@/lib/ai/agents/commercial-model";

export const runtime = "nodejs";
export const maxDuration = 120;

const RequestSchema = z.object({ tenderId: z.string().min(1) });

/**
 * POST /api/ai/commercial-model
 * Generates the per-bid commercial model (delivery / pricing / partnering /
 * terms / risks / win themes) grounded in the tender, the Knowledge Brain, and
 * the award benchmark. Returns 202 + jobId; client polls /api/ai/jobs/[id].
 * Re-running replaces the previous model. WRITER+; one AI credit per run.
 */
export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { tenderId } = parsed.data;

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await db.member.findFirst({
    where: { clerkUserId: userId, orgId: org.id, isActive: true, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!member || !hasRole(member.role, "WRITER")) {
    return NextResponse.json({ error: "Requires Writer role or higher" }, { status: 403 });
  }

  const tender = await db.tender.findFirst({
    where: { id: tenderId, orgId: org.id, deletedAt: null },
    select: { id: true },
  });
  if (!tender) return NextResponse.json({ error: "Tender not found" }, { status: 404 });

  const quota = await checkAndConsumeAiCredit(org.id);
  if (!quota.ok) return NextResponse.json({ error: quota.error, code: quota.code }, { status: 402 });

  const job = await db.aIJob.create({
    data: {
      orgId: org.id,
      memberId: member.id,
      jobType: "COMMERCIAL_MODEL",
      resourceType: "tender",
      resourceId: tenderId,
      status: "QUEUED",
      progress: 0,
      inputMetadata: { tenderId },
    },
  });

  after(async () => {
    try {
      await runCommercialModelAgent(job.id, tenderId, org.id, member.id);
    } catch (err) {
      console.error("[commercial-model] agent failed:", err);
      await db.aIJob
        .update({ where: { id: job.id }, data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "Generation failed" } })
        .catch(() => {});
    }
  });

  return NextResponse.json({ jobId: job.id, status: "QUEUED" }, { status: 202 });
}
