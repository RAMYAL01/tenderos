import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { createPresignedUploadUrl, generateDocumentKey, validateFile } from "@/lib/s3";

/**
 * POST /api/knowledge/upload-url — Step 1 of the Knowledge Brain file upload.
 * Returns a presigned URL for a direct browser → R2 PUT (bypasses the 4.5 MB
 * serverless body limit). Tender-free: knowledge files live under a per-org
 * "_knowledge" prefix. The file is extracted then discarded by /api/knowledge/upload.
 */
const RequestSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().positive(),
});

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { filename, mimeType, fileSizeBytes } = parsed.data;

  const validation = validateFile(filename, mimeType, fileSizeBytes);
  if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 });

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  // Per-org knowledge prefix (no tender). The upload route re-checks this prefix.
  const storageKey = generateDocumentKey(org.id, "_knowledge", filename);
  const uploadUrl = await createPresignedUploadUrl(storageKey, mimeType);

  return NextResponse.json({ uploadUrl, storageKey });
}
