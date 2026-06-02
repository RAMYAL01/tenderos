import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { generateDocx } from "@/lib/export/export-docx";
import { uploadToS3, generateExportKey } from "@/lib/s3";

export const runtime = "nodejs";
export const maxDuration = 120;

const ExportSchema = z.object({
  format: z.enum(["docx", "pdf", "bilingual_docx"]).default("docx"),
  language: z.enum(["EN", "AR", "AR_SA", "AR_AE", "AR_EG", "BILINGUAL"]).optional(),
});

/**
 * POST /api/proposals/[id]/export
 *
 * Generates a DOCX or PDF export of the proposal.
 * For DOCX: generated server-side and uploaded to S3, returns download URL.
 * For PDF: returns a print preview URL (browser-based PDF via print dialog).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = ExportSchema.safeParse(body);
  const { format, language } = parsed.success ? parsed.data : { format: "docx" as const, language: undefined };

  // Load proposal with all sections
  const proposal = await db.proposal.findFirst({
    where: { id, orgId: org.id, deletedAt: null },
    include: {
      sections: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
      },
      tender: {
        select: {
          titleEn: true, titleAr: true,
          clientName: true, referenceNo: true, tenderType: true,
        },
      },
    },
  });

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  // PDF: return print URL (browser prints to PDF)
  if (format === "pdf") {
    const printUrl = `${process.env.NEXT_PUBLIC_APP_URL}/tenders/${proposal.tenderId}/proposals/${id}/print`;
    return NextResponse.json({ type: "print_url", url: printUrl });
  }

  // DOCX: generate server-side
  try {
    const exportLanguage = language ?? proposal.language;

    const docxBuffer = await generateDocx({
      title: proposal.title,
      language: exportLanguage,
      tender: {
        titleEn: proposal.tender.titleEn,
        titleAr: proposal.tender.titleAr ?? undefined,
        clientName: proposal.tender.clientName ?? undefined,
        referenceNo: proposal.tender.referenceNo ?? undefined,
        tenderType: proposal.tender.tenderType ?? undefined,
      },
      sections: proposal.sections.map((s) => ({
        sectionType: s.sectionType,
        titleEn: s.titleEn,
        titleAr: s.titleAr,
        contentEn: s.contentEn,
        contentAr: s.contentAr,
        orderIndex: s.orderIndex,
      })),
      exportedAt: new Date().toISOString(),
    });

    // Upload to S3
    const storageKey = generateExportKey(org.id, id, "docx");
    await uploadToS3(
      storageKey,
      docxBuffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    // Create export job record
    const member = await db.member.findFirst({
      where: { clerkUserId: userId, orgId: org.id },
      select: { id: true },
    });

    const { createPresignedDownloadUrl } = await import("@/lib/s3");
    const sanitizedTitle = proposal.title.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_");
    const filename = `${sanitizedTitle}_v${proposal.currentVersion}.docx`;

    await db.exportJob.create({
      data: {
        proposalId: id,
        orgId: org.id,
        format: format === "bilingual_docx" ? "BILINGUAL_DOCX" : "DOCX",
        language: exportLanguage as any,
        status: "COMPLETED",
        outputStorageKey: storageKey,
        outputFilename: filename,
        outputSizeBytes: BigInt(docxBuffer.length),
        downloadExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdById: member?.id ?? org.id,
      },
    });

    const downloadUrl = await createPresignedDownloadUrl(storageKey, filename);

    // Mark proposal as exported
    await db.proposal.update({
      where: { id },
      data: { status: "EXPORTED" },
    });

    return NextResponse.json({
      type: "download",
      downloadUrl,
      filename,
      sizeBytes: docxBuffer.length,
    });
  } catch (err) {
    console.error("[export] DOCX generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
