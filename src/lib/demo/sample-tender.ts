import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  SAMPLE_TENDER,
  SAMPLE_DOCUMENT,
  SAMPLE_REQUIREMENTS,
  SAMPLE_BID,
  SAMPLE_SECTIONS,
} from "./sample-content";

/**
 * Demo Mode (in-app) — seeds the shared sample-content into a real org so a new
 * workspace experiences the FULL workflow (requirements → compliance → bid score
 * → proposal) with no upload.
 *
 * Reuses the EXISTING models so it renders through the same UI as real projects —
 * no parallel demo system. Content comes from ./sample-content (the same source
 * the public /demo page renders). Flagged Tender.isSample + "[Sample]" title so
 * it's never confused with customer data, idempotent (one per org), and deletion
 * cascades via the schema FKs.
 */

const DAY = 86_400_000;

/** Idempotent: one sample tender per org. Returns the tender id (existing or new). */
export async function loadSampleTender(orgId: string, memberId: string): Promise<string> {
  const existing = await db.tender.findFirst({
    where: { orgId, isSample: true, deletedAt: null },
    select: { id: true },
  });
  if (existing) return existing.id;

  return db.$transaction(
    async (tx) => {
      const tender = await tx.tender.create({
        data: {
          orgId,
          isSample: true,
          titleEn: `[Sample] ${SAMPLE_TENDER.titleEn}`,
          referenceNo: SAMPLE_TENDER.referenceNo,
          clientName: SAMPLE_TENDER.clientName,
          clientCountry: SAMPLE_TENDER.clientCountry,
          sector: SAMPLE_TENDER.sector,
          tenderType: SAMPLE_TENDER.tenderType,
          submissionDeadline: new Date(Date.now() + SAMPLE_TENDER.deadlineDays * DAY),
          estimatedValue: SAMPLE_TENDER.estimatedValue,
          currency: SAMPLE_TENDER.currency,
          status: "ACTIVE",
          primaryLanguage: "EN",
          tags: ["sample"],
          notes: "Sample data — explore the full TenderOS workflow with no upload. Delete anytime.",
          createdById: memberId,
        },
        select: { id: true },
      });

      const doc = await tx.document.create({
        data: {
          tenderId: tender.id,
          orgId,
          filename: SAMPLE_DOCUMENT.filename,
          originalFilename: SAMPLE_DOCUMENT.filename,
          storageKey: `demo/${orgId}/riyadh-hospital-rfp.pdf`,
          storageBucket: "demo",
          mimeType: "application/pdf",
          fileSizeBytes: BigInt(SAMPLE_DOCUMENT.sizeBytes),
          pageCount: SAMPLE_DOCUMENT.pageCount,
          languageDetected: "ENGLISH",
          languageConfidence: 0.99,
          extractionMethod: "pdf-parse",
          processingStatus: "READY",
          indexedAt: new Date(),
          isPrimary: true,
          uploadedById: memberId,
        },
        select: { id: true },
      });

      // Batched to keep the transaction well under its timeout (createMany ≫ N creates).
      await tx.requirement.createMany({
        data: SAMPLE_REQUIREMENTS.map((r) => ({
          tenderId: tender.id,
          documentId: doc.id,
          orgId,
          textEn: r.textEn,
          sectionRef: `Section ${r.sectionRef}`,
          pageRef: r.pageRef,
          requirementType: r.type,
          priority: r.priority,
          confidenceScore: 0.9,
          isAiExtracted: true,
        })),
      });
      const createdReqs = await tx.requirement.findMany({
        where: { tenderId: tender.id },
        select: { id: true, sectionRef: true },
      });
      const reqIdByRef = new Map(createdReqs.map((r) => [r.sectionRef, r.id]));
      await tx.complianceMatrixRow.createMany({
        data: SAMPLE_REQUIREMENTS.map((r) => ({
          tenderId: tender.id,
          orgId,
          requirementId: reqIdByRef.get(`Section ${r.sectionRef}`)!,
          status: r.status,
          responseEn: r.responseEn ?? null,
          sectionReference: r.responseEn ? "Annex" : null,
        })),
      });

      await tx.bidDecision.create({
        data: {
          orgId,
          tenderId: tender.id,
          score: SAMPLE_BID.score,
          baseScore: SAMPLE_BID.baseScore,
          llmAdjustment: SAMPLE_BID.llmAdjustment,
          confidence: SAMPLE_BID.confidence,
          recommendation: SAMPLE_BID.recommendation,
          factors: SAMPLE_BID.factors as unknown as Prisma.InputJsonObject,
          rationale: SAMPLE_BID.rationale,
          risks: SAMPLE_BID.risks as unknown as Prisma.InputJsonValue,
          questionsToAsk: SAMPLE_BID.questions as unknown as Prisma.InputJsonValue,
          modelVersion: "sample-v1",
          createdById: memberId,
        },
      });

      const proposal = await tx.proposal.create({
        data: {
          tenderId: tender.id,
          orgId,
          title: "Technical Proposal — Riyadh Regional Hospital Expansion",
          language: "EN",
          status: "DRAFT",
          complianceScore: 67,
          createdById: memberId,
        },
        select: { id: true },
      });

      await tx.proposalSection.createMany({
        data: SAMPLE_SECTIONS.map((s, i) => ({
          proposalId: proposal.id,
          orgId,
          sectionType: s.type,
          titleEn: s.titleEn,
          contentEn: s.contentEn,
          orderIndex: i,
          isAiGenerated: true,
          contentSource: "AI_GENERATED",
          aiModelUsed: "sample-v1",
        })),
      });

      return tender.id;
    },
    { timeout: 15000 }
  );
}

/** Delete the org's sample tender (cascades to its docs/requirements/compliance/proposal/bid). */
export async function deleteSampleTender(orgId: string): Promise<number> {
  const res = await db.tender.deleteMany({ where: { orgId, isSample: true } });
  return res.count;
}
