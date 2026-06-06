/**
 * Scanned-PDF OCR for the live document-processing pipeline.
 *
 * Bridges an OCR provider into the simple `ProcessedContent` shape the rest of
 * the app consumes. Two providers, selected by what's configured:
 *
 *   1. Azure Document Intelligence  — if AZURE_DOCINTEL_* is set (best fidelity).
 *   2. Claude vision (PDF)          — else if ANTHROPIC_API_KEY is set. Reuses
 *      the key the app already has; no extra account. Handles Arabic/English.
 *
 * Used only for scanned PDFs (no extractable text). Text-based documents and
 * unconfigured environments are completely unaffected.
 */

import { PDFDocument } from "pdf-lib";
import { AzureDocumentIntelligenceProvider, isAzureOcrConfigured } from "@/lib/ingestion/ocr-provider";
import { withRetry } from "@/lib/ai/client";

export interface ScannedOcrResult {
  fullText: string;
  pages: Array<{ page: number; text: string }>;
  pageCount: number;
  /** Mean OCR word confidence (0..1). Claude has no confidence signal → 1. */
  meanConfidence: number;
  provider: "azure-document-intelligence" | "claude-vision";
}

export interface OcrInput {
  /** Presigned URL (Azure can pull it directly). */
  urlSource?: string;
  /** Raw PDF bytes (required for the Claude path). */
  bytes: Buffer;
  /** Page-count hint, if known. */
  pageCount?: number;
}

/** True when any OCR provider (Azure or Claude) is available. */
export function isOcrConfigured(): boolean {
  return isAzureOcrConfigured() || Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function ocrScannedPdf(input: OcrInput): Promise<ScannedOcrResult> {
  if (isAzureOcrConfigured()) return ocrViaAzure(input);
  if (process.env.ANTHROPIC_API_KEY) return ocrViaClaude(input.bytes);
  throw new Error("No OCR provider is configured (set AZURE_DOCINTEL_* or ANTHROPIC_API_KEY).");
}

// ── Azure path ────────────────────────────────────────────────────────────────

async function ocrViaAzure(input: OcrInput): Promise<ScannedOcrResult> {
  const provider = new AzureDocumentIntelligenceProvider();
  const ocrPages = await provider.analyzeLayout(
    input.urlSource ? { urlSource: input.urlSource } : { bytes: input.bytes },
    { maxPollMs: 290_000 }
  );
  const pages = ocrPages.map((p) => ({
    page: p.pageNumber,
    text: p.lines.map((l) => l.content).join("\n"),
  }));
  const meanConfidence = ocrPages.length
    ? ocrPages.reduce((s, p) => s + (p.meanConfidence ?? 1), 0) / ocrPages.length
    : 1;
  return {
    fullText: pages.map((p) => p.text).join("\n\n"),
    pages,
    pageCount: ocrPages.length,
    meanConfidence,
    provider: "azure-document-intelligence",
  };
}

// ── Claude path ───────────────────────────────────────────────────────────────

const CLAUDE_OCR_MODEL = "claude-sonnet-4-6";
const CHUNK_PAGES = 10; // pages per Claude request — keeps each call well within limits
const MAX_CONCURRENCY = 3;

const OCR_PROMPT =
  "You are an OCR engine. Transcribe this document EXACTLY as written. Do NOT summarize, " +
  "translate, explain, or add commentary.\n" +
  "Rules:\n" +
  "- Preserve all text in its original language (Arabic and English both appear).\n" +
  "- Preserve tables as tab-separated rows, one row per line.\n" +
  '- Wrap each page separately as <page n="N">...</page>, where N is the page number ' +
  "within THIS file starting at 1.\n" +
  "- For a blank or unreadable page output <page n=\"N\"></page>.\n" +
  "Return ONLY the <page> blocks, nothing else.";

async function ocrViaClaude(bytes: Buffer): Promise<ScannedOcrResult> {
  const chunks = await splitPdf(bytes, CHUNK_PAGES);

  // OCR each chunk (bounded concurrency), preserving order.
  const results: Array<{ page: number; text: string }>[] = new Array(chunks.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= chunks.length) return;
      const c = chunks[i];
      const text = await withRetry(() => callClaudeOcr(c.base64), 3, 1500);
      results[i] = parsePages(text, c.startPage);
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, chunks.length) }, worker));

  const pages = results.flat().filter((p) => p.text.trim().length > 0);
  pages.sort((a, b) => a.page - b.page);

  return {
    fullText: pages.map((p) => p.text).join("\n\n"),
    pages,
    pageCount: pages.length,
    meanConfidence: 1,
    provider: "claude-vision",
  };
}

interface PdfChunk {
  base64: string;
  startPage: number; // 1-based global page index of this chunk's first page
}

async function splitPdf(bytes: Buffer, perChunk: number): Promise<PdfChunk[]> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const chunks: PdfChunk[] = [];
  for (let start = 0; start < total; start += perChunk) {
    const end = Math.min(start + perChunk, total);
    const sub = await PDFDocument.create();
    const copied = await sub.copyPages(
      src,
      Array.from({ length: end - start }, (_, k) => start + k)
    );
    copied.forEach((p) => sub.addPage(p));
    const subBytes = await sub.save();
    chunks.push({
      base64: Buffer.from(subBytes).toString("base64"),
      startPage: start + 1,
    });
  }
  return chunks;
}

async function callClaudeOcr(pdfBase64: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_OCR_MODEL,
      max_tokens: 16000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
            },
            { type: "text", text: OCR_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Claude OCR failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return (json.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("");
}

/** Parse <page n="N">…</page> blocks; offset local page numbers to global. */
function parsePages(text: string, startPage: number): Array<{ page: number; text: string }> {
  const out: Array<{ page: number; text: string }> = [];
  const re = /<page[^>]*\bn=["']?(\d+)["']?[^>]*>([\s\S]*?)<\/page>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const local = parseInt(m[1], 10);
    out.push({ page: startPage + (local - 1), text: m[2].trim() });
  }
  // Fallback: model didn't use page tags — treat the whole response as one page.
  if (out.length === 0 && text.trim()) {
    out.push({ page: startPage, text: text.trim() });
  }
  return out;
}
