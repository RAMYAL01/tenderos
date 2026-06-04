import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";

const RequestSchema = z.object({ tenderId: z.string().min(1) });

export const runtime = "nodejs";
export const maxDuration = 120;

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

  fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/ai/clarification-questions/process`,
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
