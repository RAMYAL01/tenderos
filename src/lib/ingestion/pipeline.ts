/**
 * Ingestion orchestrator — wires every stage together for one document.
 *
 *   OCR (chunked, async) → stitch tables → assess (fault tolerance) → if
 *   blockers: NEEDS_REVIEW & stop; else: de-noise/structure (LLM) → persist
 *   clauses → READY.
 *
 * Designed to run in a background task (Next.js `after()` / a queue worker).
 * Every failure path lands the document in a deterministic, inspectable state —
 * never a silent failure.
 */

import { DocumentStatus, RequirementType, ReviewFlagSeverity, ReviewFlagType } from "@prisma/client";
import { db } from "@/lib/prisma";
import { createPresignedDownloadUrl } from "@/lib/s3";
import type { OcrResult } from "./ocr-types";
import { AzureDocumentIntelligenceProvider, type OcrSource } from "./ocr-provider";
import { analyzeDocumentChunked } from "./chunking";
import { stitchTables, type StitchedTable } from "./stitch-tables";
import { assessIngestion, type ReviewFlagInput } from "./review-flags";
import { structureClauses } from "./denoise-prompt";

export interface IngestionSummary {
  documentId: string;
  status: DocumentStatus;
  pagesRead: number;
  tables: number;
  clauses: number;
  flags: number;
  blockers: number;
}

export async function ingestTenderDocument(documentId: string): Promise<IngestionSummary> {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    select: { id: true, tenderId: true, orgId: true, storageKey: true, filename: true, pageCount: true },
  });
  if (!doc) throw new Error(`Document ${documentId} not found`);

  await db.document.update({ where: { id: doc.id }, data: { processingStatus: DocumentStatus.OCR_PROCESSING } });

  try {
    // ── Part 1: OCR (chunked, async, fault-isolated) ──
    const url = await createPresignedDownloadUrl(doc.storageKey, doc.filename, 7200);
    const source: OcrSource = { urlSource: url };
    const provider = new AzureDocumentIntelligenceProvider();

    let ocr: OcrResult;
    if (doc.pageCount && doc.pageCount > 0) {
      ocr = await analyzeDocumentChunked(provider, source, doc.pageCount, { chunkSize: 20, concurrency: 3 });
    } else {
      const pages = await provider.analyzeLayout(source, { maxPollMs: 300_000 });
      ocr = { pages, provider: provider.name, model: provider.model, failedPageRanges: [] };
    }

    // ── Part 2: stitch cross-page tables ──
    const stitched = stitchTables(ocr.pages);

    // ── Fault tolerance: assess + persist flags ──
    const assessment = assessIngestion(ocr, stitched);
    await persistFlags(doc.id, doc.orgId, assessment.flags);

    await db.document.update({
      where: { id: doc.id },
      data: { ocrCompletedAt: new Date(), processingStatus: DocumentStatus.PARSING },
    });

    // Hard stop: if anything is untrustworthy, hold for a human — do NOT feed the LLM garbage.
    if (assessment.hasBlockers) {
      await db.document.update({ where: { id: doc.id }, data: { processingStatus: DocumentStatus.NEEDS_REVIEW } });
      return summarize(doc.id, DocumentStatus.NEEDS_REVIEW, ocr, stitched, assessment.flags);
    }

    // ── Part 3: de-noise + structure ──
    const documentText = serializeForLlm(ocr, stitched);
    const structured = await structureClauses(documentText);

    // A failed LLM shard means a chunk of the doc was never structured → review.
    if (structured.failedShards > 0) {
      await db.documentReviewFlag.create({
        data: {
          documentId: doc.id,
          orgId: doc.orgId,
          type: ReviewFlagType.LLM_STRUCTURING_FAILED,
          severity: ReviewFlagSeverity.WARNING,
          message: `${structured.failedShards}/${structured.shards} text shards failed structuring and were skipped.`,
        },
      });
    }

    // Persist clauses as Requirements.
    if (structured.clauses.length) {
      await db.requirement.createMany({
        data: structured.clauses.map((c) => ({
          tenderId: doc.tenderId,
          orgId: doc.orgId,
          documentId: doc.id,
          textEn: c.english_translation_or_equivalent || null,
          textAr: c.original_arabic_text || null,
          sectionRef: c.clause_id || null,
          requirementType: c.is_mandatory_compliance_item ? RequirementType.MANDATORY : RequirementType.INFORMATIONAL,
          isAiExtracted: true,
        })),
      });
    }

    const finalStatus = structured.failedShards > 0 ? DocumentStatus.NEEDS_REVIEW : DocumentStatus.READY;
    await db.document.update({
      where: { id: doc.id },
      data: { processingStatus: finalStatus, indexedAt: new Date() },
    });

    return {
      ...summarize(doc.id, finalStatus, ocr, stitched, assessment.flags),
      clauses: structured.clauses.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.document.update({
      where: { id: doc.id },
      data: { processingStatus: DocumentStatus.FAILED, errorMessage: message },
    });
    await db.documentReviewFlag
      .create({
        data: {
          documentId: doc.id,
          orgId: doc.orgId,
          type: ReviewFlagType.LOW_OCR_CONFIDENCE,
          severity: ReviewFlagSeverity.BLOCKER,
          message: `Ingestion failed: ${message}`,
        },
      })
      .catch(() => {});
    throw err;
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function persistFlags(documentId: string, orgId: string, flags: ReviewFlagInput[]): Promise<void> {
  if (!flags.length) return;
  await db.documentReviewFlag.createMany({
    data: flags.map((f) => ({
      documentId,
      orgId,
      type: f.type,
      severity: f.severity,
      message: f.message,
      pageNumber: f.pageNumber ?? null,
      tableIndex: f.tableIndex ?? null,
      confidence: f.confidence ?? null,
      context: f.context ? JSON.parse(JSON.stringify(f.context)) : undefined,
    })),
  });
}

/** Flatten OCR text + stitched tables into the logical-order document for the LLM. */
function serializeForLlm(ocr: OcrResult, stitched: StitchedTable[]): string {
  const pageText = ocr.pages.map((p) => p.lines.map((l) => l.content).join("\n")).join("\n\n");
  const tableText = stitched
    .map((t) => {
      const head = t.header.map((r) => r.join("\t")).join("\n");
      const body = t.rows.map((r) => r.join("\t")).join("\n");
      return `[TABLE ${t.id} | pages ${t.sourcePages.join(",")}]\n${head}\n${body}`.trim();
    })
    .join("\n\n");
  return tableText ? `${pageText}\n\n=== STITCHED TABLES ===\n${tableText}` : pageText;
}

function summarize(
  documentId: string,
  status: DocumentStatus,
  ocr: OcrResult,
  stitched: StitchedTable[],
  flags: ReviewFlagInput[]
): IngestionSummary {
  return {
    documentId,
    status,
    pagesRead: ocr.pages.length,
    tables: stitched.length,
    clauses: 0,
    flags: flags.length,
    blockers: flags.filter((f) => f.severity === ReviewFlagSeverity.BLOCKER).length,
  };
}
