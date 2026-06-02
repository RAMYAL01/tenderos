import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { processDocument } from "@/lib/document-processing/pipeline";

// Allow up to 5 minutes for document processing on Vercel Pro.
// On Vercel Hobby (free tier), this is capped at 10 seconds —
// which is sufficient for text-based PDFs up to ~50 pages.
// For larger documents, upgrade to Vercel Pro or use a job queue.
export const maxDuration = 300;

// This route uses Node.js runtime (not Edge) because pdf-parse
// and mammoth require Node.js native modules.
export const runtime = "nodejs";

/**
 * POST /api/documents/[id]/process
 *
 * Triggers the document processing pipeline for a specific document.
 *
 * This endpoint is called internally (fire-and-forget) after a document
 * is uploaded. It's protected by an internal API key, not Clerk session.
 *
 * The pipeline:
 * 1. Downloads the file from S3
 * 2. Extracts text (PDF or DOCX)
 * 3. Detects language
 * 4. Stores processed content back to S3
 * 5. Updates document status in DB
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify internal API key
    const internalKey = req.headers.get("x-internal-api-key");
    const expectedKey = process.env.INTERNAL_API_KEY ?? "dev-internal";

    if (internalKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify document exists and is in a processable state
    const document = await db.document.findUnique({
      where: { id },
      select: {
        id: true,
        processingStatus: true,
        retryCount: true,
        mimeType: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Don't reprocess already completed or quarantined documents
    if (document.processingStatus === "READY" || document.processingStatus === "QUARANTINED") {
      return NextResponse.json({
        message: `Document already in ${document.processingStatus} state`,
      });
    }

    // Limit retries (prevent infinite retry loops)
    if (document.retryCount >= 5) {
      await db.document.update({
        where: { id },
        data: {
          processingStatus: "FAILED",
          errorMessage: "Maximum retry count exceeded. Please re-upload the document.",
        },
      });
      return NextResponse.json({ error: "Max retries exceeded" }, { status: 429 });
    }

    // Run the processing pipeline
    // This is synchronous — the HTTP connection stays open until processing completes.
    // For Vercel Pro, maxDuration = 300 gives us 5 minutes.
    await processDocument(id);

    return NextResponse.json({ success: true, documentId: id });
  } catch (err) {
    console.error("[process] Error:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

/**
 * POST /api/documents/[id]/process?retry=true
 * Allows admin users to manually retry failed processing.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Allow Clerk-authenticated users to retry failed documents
  const { auth } = await import("@clerk/nextjs/server");
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const org = await db.organization.findUnique({
    where: { clerkOrgId: orgId },
  });

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const document = await db.document.findFirst({
    where: { id, orgId: org.id, processingStatus: "FAILED" },
  });

  if (!document) {
    return NextResponse.json(
      { error: "Document not found or not in FAILED state" },
      { status: 404 }
    );
  }

  // Reset status and trigger reprocessing
  await db.document.update({
    where: { id },
    data: { processingStatus: "QUEUED", errorMessage: null },
  });

  // Fire-and-forget
  const processUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/documents/${id}/process`;
  fetch(processUrl, {
    method: "POST",
    headers: { "x-internal-api-key": process.env.INTERNAL_API_KEY ?? "dev-internal" },
  }).catch(console.error);

  return NextResponse.json({ message: "Reprocessing started", documentId: id });
}
