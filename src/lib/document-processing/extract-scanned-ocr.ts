/**
 * Scanned-PDF OCR adapter for the live document-processing pipeline.
 *
 * Bridges the enterprise Azure Document Intelligence provider into the simple
 * `ProcessedContent` shape the rest of the app already consumes. Used only for
 * scanned PDFs (no extractable text), and only when Azure is configured — so
 * text-based documents and unconfigured environments are completely unaffected.
 */

import { AzureDocumentIntelligenceProvider, type OcrSource } from "@/lib/ingestion/ocr-provider";

export interface ScannedOcrResult {
  fullText: string;
  pages: Array<{ page: number; text: string }>;
  pageCount: number;
  /** Mean OCR word confidence across pages (0..1). */
  meanConfidence: number;
}

/**
 * OCR a scanned PDF and return text + per-page text. Prefers a presigned URL
 * (Azure pulls it directly) and falls back to raw bytes.
 */
export async function ocrScannedPdf(
  source: OcrSource,
  opts: { maxPollMs?: number } = {}
): Promise<ScannedOcrResult> {
  const provider = new AzureDocumentIntelligenceProvider();
  const ocrPages = await provider.analyzeLayout(source, {
    maxPollMs: opts.maxPollMs ?? 290_000,
  });

  const pages = ocrPages.map((p) => ({
    page: p.pageNumber,
    text: p.lines.map((l) => l.content).join("\n"),
  }));
  const fullText = pages.map((p) => p.text).join("\n\n");
  const meanConfidence = ocrPages.length
    ? ocrPages.reduce((sum, p) => sum + (p.meanConfidence ?? 1), 0) / ocrPages.length
    : 1;

  return { fullText, pages, pageCount: ocrPages.length, meanConfidence };
}
