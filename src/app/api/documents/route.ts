import { auth } from "@clerk/nextjs/server";
import { NextResponse, after } from "next/server";
import { track, apiContext } from "@/lib/analytics/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { z } from "zod";
import { createHash } from "crypto";
import { db } from "@/lib/prisma";
import { S3_BUCKET, downloadFromS3 } from "@/lib/s3";
import { processDocument } from "@/lib/document-processing/pipeline";

// pdf-parse / mammoth need the Node.js runtime; allow time for processing
// to run via after() once the response has been sent.
export const runtime = "nodejs";
export const maxDuration = 300;

const CreateDocumentSchema = z.object({
  tenderId: z.string().min(1),
  storageKey: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().positive(),
  isPrimary: z.boolean().default(false),
});

/**
 * POST /api/documents
 *
 * Step 2 of the upload flow — called AFTER the file has been
 * successfully uploaded to S3 via the presigned URL.
 *
 * Creates the Document record in our database and triggers
 * async processing.
 */
export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { tenderId, storageKey, filename, mimeType, fileSizeBytes, isPrimary } =
      parsed.data;

    // Look up the org
    const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Verify tender ownership
    const tender = await db.tender.findFirst({
      where: { id: tenderId, orgId: org.id, deletedAt: null },
    });
    if (!tender) {
      return NextResponse.json({ error: "Tender not found" }, { status: 404 });
    }

    // Look up the member
    const member = await db.member.findFirst({
      where: { clerkUserId: userId, orgId: org.id, isActive: true },
    });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Check for duplicate upload (same file hash)
    // We do a quick S3 download of the first 8KB for hashing
    let checksumSha256: string | undefined;
    try {
      const headData = await downloadFromS3(storageKey);
      const sample = headData.slice(0, 8192);
      checksumSha256 = createHash("sha256").update(sample).digest("hex");

      // Check if a document with this checksum already exists in this tender
      const existing = await db.document.findFirst({
        where: {
          tenderId,
          checksumSha256,
          deletedAt: null,
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: "This file has already been uploaded to this tender.", documentId: existing.id },
          { status: 409 }
        );
      }
    } catch {
      // If we can't compute hash (S3 error), continue without dedup
    }

    // If this is marked primary, unmark any existing primary
    if (isPrimary) {
      await db.document.updateMany({
        where: { tenderId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    // Create document record
    const document = await db.document.create({
      data: {
        tenderId,
        orgId: org.id,
        filename: filename.replace(/[^a-zA-Z0-9._-؀-ۿ\s]/g, "_"), // sanitize
        originalFilename: filename,
        storageKey,
        storageBucket: S3_BUCKET,
        mimeType,
        fileSizeBytes: BigInt(fileSizeBytes),
        processingStatus: "QUEUED",
        isPrimary,
        uploadedById: member.id,
        checksumSha256,
      },
    });

    const sizeBytes = Number(fileSizeBytes);
    after(() =>
      track(ANALYTICS_EVENTS.DOCUMENT_UPLOADED, apiContext({ userId, org, role: member.role }), {
        fileType: mimeType.includes("pdf") ? "pdf" : mimeType.includes("word") ? "docx" : "other",
        sizeBucket: sizeBytes < 1_000_000 ? "small" : sizeBytes < 10_000_000 ? "medium" : "large",
      })
    );

    // Update tender status to ACTIVE if still DRAFT
    if (tender.status === "DRAFT") {
      await db.tender.update({
        where: { id: tenderId },
        data: { status: "ACTIVE" },
      });
    }

    // Update storage usage
    await db.organization.update({
      where: { id: org.id },
      data: {
        storageBytesUsed: { increment: BigInt(fileSizeBytes) },
      },
    });

    // Process the document AFTER the response is sent. after() keeps the
    // serverless function alive past the response, so this runs reliably on
    // Vercel — unlike a fire-and-forget fetch(), which gets killed when the
    // function returns. processDocument() updates the doc status itself.
    after(async () => {
      try {
        await processDocument(document.id);
      } catch (err) {
        console.error(`[documents] processing failed for ${document.id}:`, err);
      }
    });

    return NextResponse.json(
      {
        documentId: document.id,
        status: "QUEUED",
        message: "Document uploaded. Processing started.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[documents POST] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
