import { auth } from "@clerk/nextjs/server";
import { NextResponse, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { checkAndConsumeAiCredit } from "@/lib/billing/quota";
import { runClarificationAgent } from "@/lib/ai/agents/clarification-questions";

const RequestSchema = z.object({ tenderId: z.string().min(1) });

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/ai/clarification-questions
 * Generates formal RFI questions for a tender.
 */
export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { tenderId } = parsed.data;
  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tender = await db.tender.findFirst({
    where: { id: tenderId, orgId: org.id },
    select: { id: true },
  });
  if (!tender) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Plan limit: one AI credit per clarification run.
  const quota = await checkAndConsumeAiCredit(org.id);
  if (!quota.ok) {
    return NextResponse.json({ error: quota.error, code: quota.code }, { status: 402 });
  }

  const job = await db.aIJob.create({
    data: {
      orgId: org.id,
      jobType: "CLARIFICATION_QUESTIONS",
      resourceType: "tender",
      resourceId: tenderId,
      modelName: "claude-sonnet-4-6",
      status: "QUEUED",
      progress: 0,
    },
  });

  after(async () => {
    try {
      await runClarificationAgent(job.id, tenderId, org.id);
    } catch (err) {
      console.error("[clarification-questions] agent failed:", err);
      await db.aIJob
        .update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorMessage: err instanceof Error ? err.message : "Clarification generation failed",
          },
        })
        .catch(() => {});
    }
  });

  return NextResponse.json({ jobId: job.id, status: "QUEUED" }, { status: 202 });
}
