/**
 * Chunked OCR orchestration for large (100+ page) PDFs.
 *
 * Rather than physically splitting the PDF (which needs a heavy PDF lib and is
 * brittle on scanned/encrypted files), we chunk LOGICALLY by page range using
 * Azure DI's `pages` parameter against a single presigned URL. Each chunk is an
 * independent async OCR job, so:
 *   - we cap concurrency to respect the provider's TPS / queue limits,
 *   - each chunk retries on 429/5xx with exponential backoff + jitter,
 *   - a chunk that ultimately fails is ISOLATED (recorded in failedPageRanges)
 *     instead of failing the whole document — fault tolerance by construction.
 */

import type { OcrPage, OcrResult } from "./ocr-types";
import { OcrError, type OcrProvider, type OcrSource } from "./ocr-provider";

export interface ChunkedOcrOptions {
  /** Pages per OCR job. 20 balances latency, cost, and per-call payload size. */
  chunkSize?: number;
  /** Max concurrent OCR jobs against the provider. */
  concurrency?: number;
  /** Retry attempts per chunk for retryable errors. */
  maxRetries?: number;
  signal?: AbortSignal;
}

export async function analyzeDocumentChunked(
  provider: OcrProvider,
  source: OcrSource,
  pageCount: number,
  opts: ChunkedOcrOptions = {}
): Promise<OcrResult> {
  const chunkSize = opts.chunkSize ?? 20;
  const concurrency = opts.concurrency ?? 3;
  const maxRetries = opts.maxRetries ?? 4;

  const ranges = buildPageRanges(pageCount, chunkSize);
  const pages: OcrPage[] = [];
  const failedPageRanges: OcrResult["failedPageRanges"] = [];

  await runPool(ranges, concurrency, async (range) => {
    const pagesParam = `${range.start}-${range.end}`;
    try {
      const chunkPages = await withRetry(
        () => provider.analyzeLayout(source, { pages: pagesParam, signal: opts.signal }),
        maxRetries,
        opts.signal
      );
      pages.push(...chunkPages);
    } catch (err) {
      // Chunk failed permanently — isolate it; the rest of the doc still ingests.
      failedPageRanges.push({
        start: range.start,
        end: range.end,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  });

  pages.sort((a, b) => a.pageNumber - b.pageNumber);
  return {
    pages,
    provider: provider.name,
    model: provider.model,
    failedPageRanges,
  };
}

export function buildPageRanges(pageCount: number, chunkSize: number): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (let start = 1; start <= Math.max(pageCount, 1); start += chunkSize) {
    ranges.push({ start, end: Math.min(start + chunkSize - 1, Math.max(pageCount, 1)) });
  }
  return ranges;
}

/** Retry a retryable OCR op with exponential backoff + jitter. */
async function withRetry<T>(fn: () => Promise<T>, maxRetries: number, signal?: AbortSignal): Promise<T> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt <= maxRetries) {
    if (signal?.aborted) throw new OcrError("aborted", false);
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof OcrError ? err.retryable : true;
      if (!retryable || attempt === maxRetries) break;
      const base = 1000 * 2 ** attempt;
      const jitter = Math.floor(Math.random() * 400);
      await new Promise((r) => setTimeout(r, base + jitter));
      attempt++;
    }
  }
  throw lastErr;
}

/** Bounded-concurrency worker pool. */
async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(concurrency, queue.length || 1) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item === undefined) break;
      await worker(item);
    }
  });
  await Promise.all(runners);
}
