/**
 * Document Processing Pipeline
 *
 * Orchestrates the full processing flow for uploaded documents:
 * 1. Download raw file from S3
 * 2. Extract text (PDF → pdf-parse, DOCX → mammoth, TXT → direct)
 * 3. Detect language (Arabic / English / Bilingual)
 * 4. Store processed content back to S3 as JSON
 * 5. Update document status in database
 *
 * Scanned PDFs (low text density) are flagged for manual review.
 * The actual OCR integration (Azure Document Intelligence) is an
 * Enterprise-tier feature added in Step 4 / Phase 3.
 */

import { db } from "@/lib/prisma";
import {
  downloadFromS3,
  uploadToS3,
  getProcessedContentKey,
  createPresignedDownloadUrl,
} from "@/lib/s3";
import { extractPdfText } from "./extract-pdf";
import { extractDocxText, extractTxtText } from "./extract-docx";
import { ocrScannedPdf, isOcrConfigured } from "./extract-scanned-ocr";
import {
  detectLanguage,
  getLanguageConfidence,
} from "./detect-language";

export interface ProcessedContent {
  fullText: string;
  pages: Array<{ page: number; text: string }>;
  pageCount: number;
  language: string;
  languageConfidence: number;
  isScanned: boolean;
  processedAt: string;
  extractionMethod: "pdf-parse" | "mammoth" | "plaintext" | "azure-ocr" | "claude-ocr" | "vlm-ocr";
  warnings?: string[];
}

/**
 * Main pipeline entry point.
 * Called after a document has been uploaded to S3.
 *
 * @param documentId - Our DB document record ID
 */
export async function processDocument(documentId: string): Promise<void> {
  console.log(`[Pipeline] Starting processing for document ${documentId}`);

  // ── 1. Fetch document metadata ─────────────────────────────────────────────
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error(`Document ${documentId} not found`);

  // Mark as processing
  await db.document.update({
    where: { id: documentId },
    data: { processingStatus: "OCR_PROCESSING" },
  });

  try {
    // ── 2. Download file from S3 ───────────────────────────────────────────────
    console.log(`[Pipeline] Downloading ${doc.storageKey} from S3`);
    await db.document.update({
      where: { id: documentId },
      data: { processingStatus: "PARSING" },
    });

    const fileBuffer = await downloadFromS3(doc.storageKey);

    // ── 3. Extract text based on MIME type ─────────────────────────────────────
    let content: ProcessedContent;

    if (doc.mimeType === "application/pdf") {
      console.log(`[Pipeline] Extracting PDF text`);
      const result = await extractPdfText(fileBuffer);

      if (result.isScanned) {
        // Scanned PDF — no extractable text. OCR it if a provider is
        // configured (Azure or Claude); otherwise keep the graceful failure.
        if (!isOcrConfigured()) {
          await db.document.update({
            where: { id: documentId },
            data: {
              processingStatus: "FAILED",
              errorMessage:
                "This appears to be a scanned PDF. Please upload a text-based PDF or DOCX file. " +
                "OCR processing for scanned documents is available on Enterprise plans.",
            },
          });
          return;
        }

        console.log(`[Pipeline] Scanned PDF — running OCR`);
        await db.document.update({
          where: { id: documentId },
          data: { processingStatus: "OCR_PROCESSING" },
        });

        // Provide a presigned URL (Azure can pull it) plus raw bytes (Claude
        // path). The adapter picks the provider that's configured.
        let urlSource: string | undefined;
        try {
          urlSource = await createPresignedDownloadUrl(doc.storageKey, doc.filename, 7200);
        } catch {
          urlSource = undefined;
        }
        const ocr = await ocrScannedPdf({
          urlSource,
          bytes: fileBuffer,
          pageCount: result.pageCount,
        });

        if (!ocr.fullText.trim()) {
          await db.document.update({
            where: { id: documentId },
            data: {
              processingStatus: "FAILED",
              errorMessage:
                "OCR completed but produced no readable text. The scan may be too low-quality.",
            },
          });
          return;
        }

        const language = detectLanguage(ocr.fullText);
        const confidence = getLanguageConfidence(ocr.fullText, language);
        const warnings =
          ocr.meanConfidence < 0.7
            ? [
                `Low OCR confidence (${Math.round(ocr.meanConfidence * 100)}%). ` +
                  `Review extracted content before relying on it.`,
              ]
            : undefined;

        content = {
          fullText: ocr.fullText,
          pages: ocr.pages,
          pageCount: ocr.pageCount,
          language,
          languageConfidence: confidence,
          isScanned: true,
          processedAt: new Date().toISOString(),
          extractionMethod:
            ocr.provider === "claude-vision"
              ? "claude-ocr"
              : ocr.provider === "local-vision"
              ? "vlm-ocr"
              : "azure-ocr",
          warnings,
        };
      } else {
        const language = detectLanguage(result.fullText);
        const confidence = getLanguageConfidence(result.fullText, language);

        content = {
          fullText: result.fullText,
          pages: result.pages,
          pageCount: result.pageCount,
          language,
          languageConfidence: confidence,
          isScanned: false,
          processedAt: new Date().toISOString(),
          extractionMethod: "pdf-parse",
        };
      }
    } else if (
      doc.mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      doc.mimeType === "application/msword"
    ) {
      console.log(`[Pipeline] Extracting DOCX text`);
      const result = await extractDocxText(fileBuffer);

      const language = detectLanguage(result.fullText);
      const confidence = getLanguageConfidence(result.fullText, language);

      content = {
        fullText: result.fullText,
        pages: result.pages,
        pageCount: result.pageCount,
        language,
        languageConfidence: confidence,
        isScanned: false,
        processedAt: new Date().toISOString(),
        extractionMethod: "mammoth",
        warnings: result.warnings,
      };
    } else if (doc.mimeType === "text/plain") {
      console.log(`[Pipeline] Extracting plain text`);
      const result = extractTxtText(fileBuffer);

      const language = detectLanguage(result.fullText);
      const confidence = getLanguageConfidence(result.fullText, language);

      content = {
        fullText: result.fullText,
        pages: result.pages,
        pageCount: result.pageCount,
        language,
        languageConfidence: confidence,
        isScanned: false,
        processedAt: new Date().toISOString(),
        extractionMethod: "plaintext",
      };
    } else {
      throw new Error(`Unsupported MIME type: ${doc.mimeType}`);
    }

    // ── 4. Store processed content in S3 ───────────────────────────────────────
    console.log(`[Pipeline] Storing processed content to S3`);
    await db.document.update({
      where: { id: documentId },
      data: { processingStatus: "INDEXING" },
    });

    const contentKey = getProcessedContentKey(documentId);
    await uploadToS3(
      contentKey,
      JSON.stringify(content, null, 2),
      "application/json"
    );

    // ── 5. Update document record ─────────────────────────────────────────────
    await db.document.update({
      where: { id: documentId },
      data: {
        processingStatus: "READY",
        pageCount: content.pageCount,
        languageDetected: content.language as any,
        languageConfidence: content.languageConfidence,
        extractionMethod: content.extractionMethod,
        ocrCompletedAt: new Date(),
        indexedAt: new Date(),
        errorMessage: null,
      },
    });

    // Update the parent tender's primary language if this is the primary document
    if (doc.isPrimary && content.language !== "UNKNOWN") {
      const languageMap: Record<string, string> = {
        ARABIC: "AR",
        ENGLISH: "EN",
        BILINGUAL: "BILINGUAL",
        UNKNOWN: "EN",
      };
      const tenderLanguage = languageMap[content.language] ?? "EN";

      await db.tender.update({
        where: { id: doc.tenderId },
        data: { primaryLanguage: tenderLanguage as any },
      });
    }

    console.log(
      `[Pipeline] ✅ Document ${documentId} processed successfully. ` +
        `Pages: ${content.pageCount}, Language: ${content.language}`
    );
  } catch (err) {
    console.error(`[Pipeline] ❌ Processing failed for ${documentId}:`, err);

    await db.document.update({
      where: { id: documentId },
      data: {
        processingStatus: "FAILED",
        errorMessage:
          err instanceof Error ? err.message : "Unknown processing error",
        retryCount: { increment: 1 },
      },
    });
  }
}

/**
 * Retrieve the processed content for a document from S3.
 * Returns null if not yet processed.
 */
export async function getProcessedContent(
  documentId: string
): Promise<ProcessedContent | null> {
  try {
    const { downloadFromS3, getProcessedContentKey } = await import("@/lib/s3");
    const key = getProcessedContentKey(documentId);
    const buffer = await downloadFromS3(key);
    return JSON.parse(buffer.toString("utf-8")) as ProcessedContent;
  } catch {
    return null;
  }
}
