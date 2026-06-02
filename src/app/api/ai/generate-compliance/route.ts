import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";

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
      modelName: "claude-3-5-haiku-20241022",
      status: "QUEUED",
      progress: 0,
      inputMetadata: { tenderId, requirementCount: reqCount },
    },
  });

  fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/ai/generate-compliance/process`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": process.env.INTERNAL_API_KEY ?? "dev-internal",
      },
      body: JSON.stringify({ jobId: job.id, tenderId, orgId: org.id }),
    }
  ).catch(console.error);

  return NextResponse.json({ jobId: job.id, status: "QUEUED" }, { status: 202 });
}
