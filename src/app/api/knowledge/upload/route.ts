import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { downloadFromS3, deleteFromS3 } from "@/lib/s3";
import { extractTextFromBuffer } from "@/lib/document-processing/extract-content";
import { ingestKnowledgeDocument } from "@/lib/knowledge/ingest";
import { KNOWLEDGE_TYPES } from "@/lib/knowledge-types";

/**
 * POST /api/knowledge/upload — Step 2 of the Knowledge Brain file upload.
 * Downloads the file the browser PUT to R2, extracts its text (reusing the tender
 * extraction pipeline), embeds it into the org's Knowledge Brain, then DISCARDS
 * the original blob (we keep only the text + vectors). Runs inline (Node, 300s).
 */
export const runtime = "nodejs";
export const maxDuration = 300;

const Schema = z.object({
  storageKey: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().positive(),
  knowledgeType: z.enum(KNOWLEDGE_TYPES).optional(),
  tags: z.array(z.string()).max(20).optional(),
});

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { storageKey, filename, mimeType, knowledgeType, tags } = parsed.data;

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const member = await db.member.findFirst({
    where: { clerkUserId: userId, orgId: org.id, isActive: true, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!member || !hasRole(member.role, "WRITER")) {
    return NextResponse.json({ error: "Requires Writer role or higher" }, { status: 403 });
  }

  // Defense-in-depth: the key must be under THIS org's knowledge prefix.
  if (!storageKey.startsWith(`${org.id}/_knowledge/`)) {
    return NextResponse.json({ error: "Invalid storage key" }, { status: 400 });
  }

  try {
    const buffer = await downloadFromS3(storageKey);
    const extracted = await extractTextFromBuffer(buffer, mimeType);
    if (!extracted.fullText.trim()) {
      await deleteFromS3(storageKey).catch(() => {});
      return NextResponse.json({ error: "No readable text found in this file." }, { status: 422 });
    }

    const title = filename.replace(/\.[^.]+$/, "").slice(0, 300) || filename;
    const result = await ingestKnowledgeDocument({
      orgId: org.id,
      memberId: member.id,
      title,
      content: extracted.fullText.slice(0, 200_000), // cap embedding cost/time per file
      tags: [knowledgeType ?? "other", ...(tags ?? [])],
    });

    // Keep only the extracted text + vectors — drop the original blob.
    await deleteFromS3(storageKey).catch(() => {});

    return NextResponse.json({ id: result.sourceId, chunks: result.chunks, method: extracted.method });
  } catch (err) {
    await deleteFromS3(storageKey).catch(() => {});
    const msg = err instanceof Error ? err.message : "Failed to process file";
    console.error("[knowledge/upload]", msg);
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
