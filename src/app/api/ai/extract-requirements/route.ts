import { auth } from "@clerk/nextjs/server";
import { NextResponse, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { checkAndConsumeAiCredit } from "@/lib/billing/quota";
import { runExtractionAgent } from "@/lib/ai/agents/extract-requirements";

export const runtime = "nodejs";
export const maxDuration = 300;

const RequestSchema = z.object({
  tenderId: z.string().min(1),
  documentIds: z.array(z.string()).min(1),
});

/**
 * POST /api/ai/extract-requirements
 *
 * Creates an AIJob and fires off the extraction pipeline.
 * Returns immediately with a jobId — client polls /api/ai/jobs/[id].
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

  const { tenderId, documentIds } = parsed.data;

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tender = await db.tender.findFirst({
    where: { id: tenderId, orgId: org.id, deletedAt: null },
  });
  if (!tender) return NextResponse.json({ error: "Tender not found" }, { status: 404 });

  // Check documents are ready
  const readyDocs = await db.document.findMany({
    where: {
      id: { in: documentIds },
      tenderId,
      processingStatus: "READY",
      deletedAt: null,
    },
    select: { id: true },
  });

  if (readyDocs.length === 0) {
    return NextResponse.json(
      { error: "No processed documents available. Wait for document processing to complete." },
      { status: 400 }
    );
  }

  // Plan limit: one AI credit per user-initiated extraction run.
  const quota = await checkAndConsumeAiCredit(org.id);
  if (!quota.ok) {
    return NextResponse.json({ error: quota.error, code: quota.code }, { status: 402 });
  }

  // Create AIJob record
  const job = await db.aIJob.create({
    data: {
      orgId: org.id,
      jobType: "EXTRACT_REQUIREMENTS",
      resourceType: "tender",
      resourceId: tenderId,
      modelName: "claude-haiku-4-5-20251001",
      status: "QUEUED",
      progress: 0,
      inputMetadata: { tenderId, documentIds: readyDocs.map((d) => d.id) },
    },
  });

  // Run the extraction after the response is sent. after() keeps the
  // function alive on Vercel (a fire-and-forget fetch would be killed).
  const docIds = readyDocs.map((d) => d.id);
  after(async () => {
    try {
      await runExtractionAgent(job.id, tenderId, docIds, org.id);
    } catch (err) {
      console.error("[extract-requirements] agent failed:", err);
      await db.aIJob
        .update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorMessage: err instanceof Error ? err.message : "Extraction failed",
          },
        })
        .catch(() => {});
    }
  });

  return NextResponse.json(
    {
      jobId: job.id,
      status: "QUEUED",
      estimatedSeconds: readyDocs.length * 30,
    },
    { status: 202 }
  );
}
