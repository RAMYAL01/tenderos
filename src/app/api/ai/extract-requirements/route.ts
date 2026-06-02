import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";

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

  // Create AIJob record
  const job = await db.aIJob.create({
    data: {
      orgId: org.id,
      jobType: "EXTRACT_REQUIREMENTS",
      resourceType: "tender",
      resourceId: tenderId,
      modelName: "claude-3-5-haiku-20241022",
      status: "QUEUED",
      progress: 0,
      inputMetadata: { tenderId, documentIds: readyDocs.map((d) => d.id) },
    },
  });

  // Fire-and-forget processing
  const processUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/ai/extract-requirements/process`;
  fetch(processUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-api-key": process.env.INTERNAL_API_KEY ?? "dev-internal",
    },
    body: JSON.stringify({
      jobId: job.id,
      tenderId,
      documentIds: readyDocs.map((d) => d.id),
      orgId: org.id,
    }),
  }).catch((err) =>
    console.error("[extract-requirements] Failed to trigger process:", err)
  );

  return NextResponse.json(
    {
      jobId: job.id,
      status: "QUEUED",
      estimatedSeconds: readyDocs.length * 30,
    },
    { status: 202 }
  );
}
