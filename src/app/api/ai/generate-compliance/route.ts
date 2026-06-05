import { auth } from "@clerk/nextjs/server";
import { NextResponse, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { runComplianceAgent } from "@/lib/ai/agents/generate-compliance";

export const runtime = "nodejs";
export const maxDuration = 300;

const RequestSchema = z.object({ tenderId: z.string().min(1) });

/**
 * POST /api/ai/generate-compliance
 * Maps extracted requirements to proposal sections.
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

  const reqCount = await db.requirement.count({
    where: { tenderId, deletedAt: null },
  });

  if (reqCount === 0) {
    return NextResponse.json(
      { error: "No requirements found. Extract requirements first." },
      { status: 400 }
    );
  }

  const job = await db.aIJob.create({
    data: {
      orgId: org.id,
      jobType: "GENERATE_COMPLIANCE_MATRIX",
      resourceType: "tender",
      resourceId: tenderId,
      modelName: "claude-haiku-4-5-20251001",
      status: "QUEUED",
      progress: 0,
      inputMetadata: { tenderId, requirementCount: reqCount },
    },
  });

  after(async () => {
    try {
      await runComplianceAgent(job.id, tenderId, org.id);
    } catch (err) {
      console.error("[generate-compliance] agent failed:", err);
      await db.aIJob
        .update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorMessage: err instanceof Error ? err.message : "Compliance generation failed",
          },
        })
        .catch(() => {});
    }
  });

  return NextResponse.json({ jobId: job.id, status: "QUEUED" }, { status: 202 });
}
