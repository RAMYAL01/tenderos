/**
 * Part 1 — The Vision/OCR Layer.
 *
 * `OcrProvider` is the port. `AzureDocumentIntelligenceProvider` is the concrete
 * adapter, talking to Azure Document Intelligence (Form Recognizer) v4 over its
 * REST API with `fetch` — no SDK dependency, serverless-friendly. Azure DI is a
 * great fit for messy MENA tenders: strong Arabic OCR + table structure.
 *
 * Async by nature: Azure DI is a 202 + Operation-Location + long-poll API. We
 * implement bounded exponential-backoff polling and honor 429 Retry-After.
 *
 * (Google Document AI maps onto the same `OcrProvider` interface — implement
 * `analyzeLayout` against `documents.process` / `batchProcess` and map its
 * `Document.pages[].tables` into the normalized model below.)
 */

import {
  type OcrPage,
  type OcrTable,
  type OcrTableCell,
  type OcrWord,
  type Polygon,
  bbox,
  centroid,
  inferDirection,
  pointInBBox,
} from "./ocr-types";

/** A page-range OCR request against one document. */
export interface OcrSource {
  /** A presigned URL to the PDF (preferred — Azure pulls it; no re-upload). */
  urlSource?: string;
  /** Or raw bytes (used when no signed URL is available). */
  bytes?: Buffer | Uint8Array;
}

export interface AnalyzeOptions {
  /** 1-based inclusive page range, e.g. "1-30". Omit for the whole document. */
  pages?: string;
  /** Hard ceiling for the long-poll, in ms. */
  maxPollMs?: number;
  signal?: AbortSignal;
}

export interface OcrProvider {
  readonly name: string;
  readonly model: string;
  analyzeLayout(source: OcrSource, opts?: AnalyzeOptions): Promise<OcrPage[]>;
}

export class OcrError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number
  ) {
    super(message);
    this.name = "OcrError";
  }
}

/** True when Azure Document Intelligence credentials are present in the env. */
export function isAzureOcrConfigured(): boolean {
  return Boolean(process.env.AZURE_DOCINTEL_ENDPOINT && process.env.AZURE_DOCINTEL_KEY);
}

// ── Azure Document Intelligence REST adapter ──────────────────────────────────

const API_VERSION = "2024-11-30"; // v4.0 GA
const MODEL_ID = "prebuilt-layout";

export class AzureDocumentIntelligenceProvider implements OcrProvider {
  readonly name = "azure-document-intelligence";
  readonly model = MODEL_ID;

  private readonly endpoint: string;
  private readonly apiKey: string;

  constructor(endpoint?: string, apiKey?: string) {
    this.endpoint = (endpoint ?? process.env.AZURE_DOCINTEL_ENDPOINT ?? "").replace(/\/+$/, "");
    this.apiKey = apiKey ?? process.env.AZURE_DOCINTEL_KEY ?? "";
    if (!this.endpoint || !this.apiKey) {
      throw new OcrError("AZURE_DOCINTEL_ENDPOINT / AZURE_DOCINTEL_KEY are not configured", false);
    }
  }

  async analyzeLayout(source: OcrSource, opts: AnalyzeOptions = {}): Promise<OcrPage[]> {
    const operationLocation = await this.submit(source, opts);
    const analyzeResult = await this.poll(operationLocation, opts.maxPollMs ?? 180_000, opts.signal);
    return mapAnalyzeResult(analyzeResult);
  }

  /** Submit the analyze job; returns the Operation-Location to poll. */
  private async submit(source: OcrSource, opts: AnalyzeOptions): Promise<string> {
    const url = new URL(
      `${this.endpoint}/documentintelligence/documentModels/${MODEL_ID}:analyze`
    );
    url.searchParams.set("api-version", API_VERSION);
    if (opts.pages) url.searchParams.set("pages", opts.pages);

    const headers: Record<string, string> = { "Ocp-Apim-Subscription-Key": this.apiKey };
    let body: BodyInit;
    if (source.urlSource) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify({ urlSource: source.urlSource });
    } else if (source.bytes) {
      headers["Content-Type"] = "application/pdf";
      body = Buffer.from(source.bytes);
    } else {
      throw new OcrError("OcrSource requires either urlSource or bytes", false);
    }

    const res = await fetch(url, { method: "POST", headers, body, signal: opts.signal });
    if (res.status === 429) {
      throw new OcrError("Azure DI rate limited on submit", true, 429);
    }
    if (res.status !== 202) {
      const detail = await safeText(res);
      throw new OcrError(`Azure DI submit failed (${res.status}): ${detail}`, res.status >= 500, res.status);
    }
    const opLoc = res.headers.get("operation-location");
    if (!opLoc) throw new OcrError("Azure DI did not return an Operation-Location header", true);
    return opLoc;
  }

  /** Bounded exponential-backoff poll of the operation until a terminal state. */
  private async poll(operationLocation: string, maxPollMs: number, signal?: AbortSignal): Promise<AzureAnalyzeResult> {
    const started = Date.now();
    let delay = 1000;
    for (;;) {
      if (signal?.aborted) throw new OcrError("OCR poll aborted", false);
      if (Date.now() - started > maxPollMs) {
        throw new OcrError(`Azure DI poll timed out after ${maxPollMs}ms`, true);
      }

      const res = await fetch(operationLocation, {
        headers: { "Ocp-Apim-Subscription-Key": this.apiKey },
        signal,
      });

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") ?? "5") * 1000;
        await sleep(Math.max(retryAfter, delay));
        continue;
      }
      if (!res.ok) {
        throw new OcrError(`Azure DI poll failed (${res.status})`, res.status >= 500, res.status);
      }

      const json = (await res.json()) as { status: string; error?: { message?: string }; analyzeResult?: AzureAnalyzeResult };
      switch (json.status) {
        case "succeeded":
          if (!json.analyzeResult) throw new OcrError("Azure DI succeeded with no analyzeResult", true);
          return json.analyzeResult;
        case "failed":
          throw new OcrError(`Azure DI analysis failed: ${json.error?.message ?? "unknown"}`, false);
        case "running":
        case "notStarted":
          await sleep(delay);
          delay = Math.min(delay * 1.5, 5000); // backoff, capped at 5s
          continue;
        default:
          await sleep(delay);
      }
    }
  }
}

// ── Azure response → normalized model ─────────────────────────────────────────

interface AzureAnalyzeResult {
  pages?: Array<{
    pageNumber: number;
    width?: number;
    height?: number;
    unit?: string;
    angle?: number;
    words?: Array<{ content: string; polygon?: number[]; confidence?: number }>;
    lines?: Array<{ content: string; polygon?: number[] }>;
  }>;
  tables?: Array<{
    rowCount: number;
    columnCount: number;
    cells: Array<{
      rowIndex: number;
      columnIndex: number;
      rowSpan?: number;
      columnSpan?: number;
      content: string;
      kind?: string;
      boundingRegions?: Array<{ pageNumber: number; polygon?: number[] }>;
    }>;
    boundingRegions?: Array<{ pageNumber: number; polygon?: number[] }>;
  }>;
}

function mapAnalyzeResult(result: AzureAnalyzeResult): OcrPage[] {
  const pages: OcrPage[] = (result.pages ?? []).map((p) => {
    const words: OcrWord[] = (p.words ?? []).map((w) => ({
      content: w.content,
      polygon: w.polygon ?? [],
      confidence: typeof w.confidence === "number" ? w.confidence : 1,
    }));
    const meanConfidence = words.length
      ? words.reduce((s, w) => s + w.confidence, 0) / words.length
      : 1;
    const allText = (p.lines ?? []).map((l) => l.content).join(" ");

    return {
      pageNumber: p.pageNumber,
      width: p.width ?? 0,
      height: p.height ?? 0,
      unit: p.unit ?? "inch",
      angle: p.angle,
      words,
      lines: (p.lines ?? []).map((l) => ({
        content: l.content,
        polygon: l.polygon ?? [],
        direction: inferDirection(l.content),
      })),
      tables: [],
      meanConfidence,
      dominantDirection: inferDirection(allText),
    };
  });

  const pageByNumber = new Map(pages.map((p) => [p.pageNumber, p]));

  for (const t of result.tables ?? []) {
    const startPage = t.boundingRegions?.[0]?.pageNumber ?? t.cells[0]?.boundingRegions?.[0]?.pageNumber ?? 1;
    const page = pageByNumber.get(startPage);
    if (!page) continue;

    const cells: OcrTableCell[] = t.cells.map((c) => {
      const polygon = c.boundingRegions?.find((r) => r.pageNumber === startPage)?.polygon ?? c.boundingRegions?.[0]?.polygon;
      return {
        rowIndex: c.rowIndex,
        columnIndex: c.columnIndex,
        rowSpan: c.rowSpan ?? 1,
        columnSpan: c.columnSpan ?? 1,
        content: c.content ?? "",
        kind: normalizeKind(c.kind),
        polygon,
        confidence: polygon ? cellConfidence(polygon, page.words, startPage) : page.meanConfidence,
      };
    });

    const tablePolygon = t.boundingRegions?.find((r) => r.pageNumber === startPage)?.polygon;
    const table: OcrTable = {
      pageNumber: startPage,
      rowCount: t.rowCount,
      columnCount: t.columnCount,
      cells,
      polygon: tablePolygon,
      confidence: cells.length ? cells.reduce((s, c) => s + c.confidence, 0) / cells.length : page.meanConfidence,
      columnAnchors: computeColumnAnchors(cells, t.columnCount, page.width),
    };
    page.tables.push(table);
  }

  return pages;
}

function normalizeKind(kind?: string): OcrTableCell["kind"] {
  switch (kind) {
    case "columnHeader":
      return "columnHeader";
    case "rowHeader":
      return "rowHeader";
    case "stubHead":
      return "stubHead";
    default:
      return "content";
  }
}

/** Mean confidence of the words whose centroid falls within the cell polygon. */
function cellConfidence(cellPolygon: Polygon, words: OcrWord[], _pageNumber: number): number {
  const inside = words.filter((w) => w.polygon.length >= 4 && pointInBBox(centroid(w.polygon), cellPolygon));
  if (inside.length === 0) return 1;
  return inside.reduce((s, w) => s + w.confidence, 0) / inside.length;
}

/** Per-column x-centroid, normalized to 0..1 of page width. */
function computeColumnAnchors(cells: OcrTableCell[], columnCount: number, pageWidth: number): number[] {
  const anchors: number[] = [];
  for (let col = 0; col < columnCount; col++) {
    const colCells = cells.filter((c) => c.columnIndex === col && c.polygon && c.polygon.length >= 4);
    if (colCells.length === 0) {
      anchors.push(columnCount > 1 ? col / (columnCount - 1) : 0.5);
      continue;
    }
    const meanX = colCells.reduce((s, c) => s + centroid(c.polygon as Polygon).x, 0) / colCells.length;
    anchors.push(pageWidth > 0 ? meanX / pageWidth : 0);
  }
  return anchors;
}

// ── small utils ───────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}

// re-export for callers that only need geometry helpers from one place
export { bbox };
