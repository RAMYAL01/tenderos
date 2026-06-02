import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { createPresignedDownloadUrl, deleteFromS3 } from "@/lib/s3";

/**
 * GET /api/documents/[id]
 * Returns document metadata + presigned download URL.
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
    if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const document = await db.document.findFirst({
      where: { id, orgId: org.id, deletedAt: null },
      include: {
        uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Generate presigned download URL (15-minute expiry)
    const downloadUrl = await createPresignedDownloadUrl(
      document.storageKey,
      document.originalFilename
    );

    return NextResponse.json({ ...document, downloadUrl });
  } catch (err) {
    console.error("[document GET] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/documents/[id]
 * Soft-deletes the document record and removes the file from S3.
 */
export async function DELETE(
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
    if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const document = await db.document.findFirst({
      where: { id, orgId: org.id, deletedAt: null },
    });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Soft-delete the DB record
    await db.document.update({
      where: { id },
      data: { deletedAt: new Date(), processingStatus: "FAILED" },
    });

    // Delete the file from S3 (non-blocking)
    deleteFromS3(document.storageKey).catch((err) =>
      console.error(`Failed to delete S3 object ${document.storageKey}:`, err)
    );

    // Update storage usage
    await db.organization.update({
      where: { id: org.id },
      data: {
        storageBytesUsed: {
          decrement: document.fileSizeBytes,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[document DELETE] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
