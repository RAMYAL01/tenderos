import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import {
  createPresignedUploadUrl,
  generateDocumentKey,
  validateFile,
} from "@/lib/s3";

const RequestSchema = z.object({
  tenderId: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().positive(),
});

/**
 * POST /api/documents/upload-url
 *
 * Step 1 of the upload flow.
 * Returns a presigned S3 URL for direct browser → S3 upload.
 * The file never touches our server.
 *
 * Body: { tenderId, filename, mimeType, fileSizeBytes }
 * Returns: { uploadUrl, storageKey }
 */
export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { tenderId, filename, mimeType, fileSizeBytes } = parsed.data;

    // Validate file type and size
    const validation = validateFile(filename, mimeType, fileSizeBytes);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Verify the tender belongs to this org
    const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const tender = await db.tender.findFirst({
      where: { id: tenderId, orgId: org.id, deletedAt: null },
    });
    if (!tender) {
      return NextResponse.json({ error: "Tender not found" }, { status: 404 });
    }

    // Check storage quota
    const subscription = await db.subscription.findUnique({
      where: { orgId: org.id },
    });
    const storageLimit = org.storageBytesLimit;
    const storageUsed = subscription?.storageBytesUsed ?? BigInt(0);
    if (BigInt(fileSizeBytes) + storageUsed > storageLimit) {
      return NextResponse.json(
        { error: "Storage limit exceeded. Please upgrade your plan." },
        { status: 402 }
      );
    }

    // Generate unique S3 key
    const storageKey = generateDocumentKey(org.id, tenderId, filename);

    // Create presigned upload URL (valid for 5 minutes)
    const uploadUrl = await createPresignedUploadUrl(storageKey, mimeType);

    return NextResponse.json({ uploadUrl, storageKey });
  } catch (err) {
    console.error("[upload-url] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
