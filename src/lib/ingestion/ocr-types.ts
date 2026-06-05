/**
 * Normalized, provider-agnostic OCR layout model.
 *
 * Azure Document Intelligence and Google Document AI return different shapes;
 * every downstream stage (stitching, review-flagging, LLM structuring) speaks
 * ONLY this normalized model, so swapping OCR vendors never touches the rest of
 * the pipeline.
 *
 * Geometry: polygons are flat [x1,y1,x2,y2,...] in `OcrPage.unit`. We also carry
 * page width/height so geometry can be normalized to 0..1 for cross-page logic.
 */

export type Polygon = number[];

export type TextDirection = "ltr" | "rtl" | "mixed" | "neutral";

export interface OcrWord {
  content: string;
  polygon: Polygon;
  confidence: number; // 0..1
}

export interface OcrLine {
  content: string;
  polygon: Polygon;
  /** Dominant script direction, inferred from unicode ranges. */
  direction: TextDirection;
}

export type CellKind = "content" | "columnHeader" | "rowHeader" | "stubHead";

export interface OcrTableCell {
  rowIndex: number;
  columnIndex: number;
  rowSpan: number;
  columnSpan: number;
  content: string;
  kind: CellKind;
  polygon?: Polygon;
  /** Aggregate confidence of the words inside this cell (0..1). */
  confidence: number;
}

export interface OcrTable {
  /** 1-based page the table starts on. */
  pageNumber: number;
  rowCount: number;
  columnCount: number;
  cells: OcrTableCell[];
  /** Bounding polygon on its starting page. */
  polygon?: Polygon;
  /** Aggregate confidence across the table's words (0..1). */
  confidence: number;
  /**
   * Column x-centroids NORMALIZED to 0..1 of page width — the fingerprint used
   * to decide whether a table on page N+1 continues a table on page N.
   */
  columnAnchors: number[];
}

export interface OcrPage {
  pageNumber: number; // 1-based
  width: number;
  height: number;
  unit: string; // "inch" | "pixel"
  angle?: number;
  lines: OcrLine[];
  words: OcrWord[];
  tables: OcrTable[];
  /** Mean word confidence on the page (0..1). 1 when there are no words. */
  meanConfidence: number;
  /** Dominant direction of the page's text. */
  dominantDirection: TextDirection;
}

export interface OcrResult {
  pages: OcrPage[];
  provider: string; // "azure-document-intelligence" | "google-document-ai"
  model: string; // e.g. "prebuilt-layout"
  /** Page ranges that failed OCR entirely (chunk-level failures), 1-based. */
  failedPageRanges: Array<{ start: number; end: number; reason: string }>;
}

// ── Geometry + script helpers (shared by all stages) ──────────────────────────

const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LATIN_RE = /[A-Za-z]/;

/** Infer reading direction from the unicode content of a string. */
export function inferDirection(text: string): TextDirection {
  const hasArabic = ARABIC_RE.test(text);
  const hasLatin = LATIN_RE.test(text);
  if (hasArabic && hasLatin) return "mixed";
  if (hasArabic) return "rtl";
  if (hasLatin) return "ltr";
  return "neutral";
}

/** Axis-aligned bounding box from a flat polygon. */
export function bbox(polygon: Polygon): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < polygon.length; i += 2) {
    const x = polygon[i];
    const y = polygon[i + 1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function centroid(polygon: Polygon): { x: number; y: number } {
  const b = bbox(polygon);
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

/** True if `point` falls inside the axis-aligned bbox of `polygon` (with margin). */
export function pointInBBox(point: { x: number; y: number }, polygon: Polygon, margin = 0): boolean {
  const b = bbox(polygon);
  return (
    point.x >= b.minX - margin &&
    point.x <= b.maxX + margin &&
    point.y >= b.minY - margin &&
    point.y <= b.maxY + margin
  );
}
