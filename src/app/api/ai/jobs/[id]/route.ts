import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

/**
 * GET /api/ai/jobs/[id]
 *
 * Universal polling endpoint for all AI jobs.
 * Client polls this until status === "COMPLETED" or "FAILED".
 *
 * Response includes:
 * - status: QUEUED | PROCESSING | COMPLETED | FAILED
 * - progress: 0-100
 * - resultRef: available when COMPLETED (varies by job type)
 * - errorMessage: available when FAILED
 * - usage/cost metadata
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

  const job = await db.aIJob.findFirst({
    where: { id, orgId: org.id },
    select: {
      id: true,
      jobType: true,
      resourceType: true,
      resourceId: true,
      modelName: true,
      status: true,
      progress: true,
      resultRef: true,
      errorMessage: true,
      totalTokens: true,
      costUsd: true,
      latencyMs: true,
      outputMetadata: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // For COMPLETED jobs, include a result summary based on job type
  let result: Record<string, unknown> | null = null;

  if (job.status === "COMPLETED") {
    if (job.jobType === "EXTRACT_REQUIREMENTS" && job.resourceId) {
      const [total, mandatory, critical] = await Promise.all([
        db.requirement.count({
          where: { tenderId: job.resourceId, deletedAt: null },
        }),
        db.requirement.count({
          where: {
            tenderId: job.resourceId,
            requirementType: "MANDATORY",
            deletedAt: null,
          },
        }),
        db.requirement.count({
          where: {
            tenderId: job.resourceId,
            priority: "CRITICAL",
            deletedAt: null,
          },
        }),
      ]);
      result = { total, mandatory, critical };
    }

    if (job.jobType === "GENERATE_COMPLIANCE_MATRIX" && job.resourceId) {
      const [total, completed, gaps] = await Promise.all([
        db.complianceMatrixRow.count({ where: { tenderId: job.resourceId } }),
        db.complianceMatrixRow.count({
          where: { tenderId: job.resourceId, status: "COMPLETED" },
        }),
        db.complianceMatrixRow.count({
          where: { tenderId: job.resourceId, status: "NOT_STARTED" },
        }),
      ]);
      result = { total, completed, gaps };
    }

    if (job.jobType === "CLARIFICATION_QUESTIONS" && job.resultRef) {
      try {
        result = JSON.parse(job.resultRef);
      } catch {}
    }
  }

  return NextResponse.json({
    id: job.id,
    jobType: job.jobType,
    resourceId: job.resourceId,
    status: job.status,
    progress: job.progress,
    result,
    errorMessage: job.errorMessage,
    totalTokens: job.totalTokens,
    costUsd: job.costUsd,
    latencyMs: job.latencyMs,
    metadata: job.outputMetadata,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
}
