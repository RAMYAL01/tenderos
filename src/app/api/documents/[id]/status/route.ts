import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

/**
 * GET /api/documents/[id]/status
 *
 * Lightweight polling endpoint. Returns only what the
 * frontend needs to track progress — not the full document.
 *
 * Used by the client to poll until status === "READY" or "FAILED".
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
    if (!org) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const document = await db.document.findFirst({
      where: { id, orgId: org.id, deletedAt: null },
      select: {
        id: true,
        processingStatus: true,
        languageDetected: true,
        pageCount: true,
        errorMessage: true,
        ocrCompletedAt: true,
        retryCount: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Map processing status to a progress percentage for the UI
    const progressMap: Record<string, number> = {
      PENDING: 5,
      QUEUED: 10,
      SCANNING: 20,
      OCR_PROCESSING: 40,
      PARSING: 60,
      INDEXING: 80,
      READY: 100,
      FAILED: 0,
      QUARANTINED: 0,
    };

    return NextResponse.json({
      id: document.id,
      status: document.processingStatus,
      progress: progressMap[document.processingStatus] ?? 0,
      languageDetected: document.languageDetected,
      pageCount: document.pageCount,
      errorMessage: document.errorMessage,
      processedAt: document.ocrCompletedAt,
      retryCount: document.retryCount,
    });
  } catch (err) {
    console.error("[document status] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
