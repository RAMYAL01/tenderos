/**
 * Part 2 — Cross-Page Table Stitching (deterministic; no AI).
 *
 * BOQ tables routinely break across page boundaries. The OCR engine returns one
 * `OcrTable` per page fragment, so a single logical BOQ becomes N disjoint
 * tables. This utility re-assembles them BEFORE the LLM ever sees them.
 *
 * A fragment on page P+1 is judged to CONTINUE a fragment on page P when ALL of:
 *   1. pages are adjacent (P+1 directly follows P),
 *   2. the column counts are equal,
 *   3. the per-column x-anchors line up within tolerance (the "fingerprint"),
 *   4. the upper fragment ends near the bottom of its page, AND
 *   5. the lower fragment starts near the top of its page.
 * A repeated header row on the continuation page is detected and DROPPED.
 *
 * Everything is pure + reproducible: same OCR input → same stitched output.
 */

import type { OcrPage, OcrTable, Polygon } from "./ocr-types";
import { bbox } from "./ocr-types";

export interface StitchedTable {
  id: string;
  columnCount: number;
  header: string[][]; // header rows (possibly empty)
  rows: string[][]; // data rows, stitched in document order
  sourcePages: number[]; // contributing pages, in order
  columnAnchors: number[];
  confidence: number; // min confidence across stitched fragments
  stitched: boolean; // true if assembled from more than one page
  warnings: string[]; // e.g. ambiguous alignment — feeds human-review flags
}

// Tunable heuristics (documented, not magic).
const ANCHOR_TOLERANCE = 0.04; // 4% of page width
const ANCHOR_MIN_MATCH = 0.6; // ≥60% of columns must align to count as continuation
const ANCHOR_STRONG_MATCH = 0.85; // below this → flag STITCH_AMBIGUITY
const BOTTOM_THRESHOLD = 0.8; // upper fragment must end past 80% of page height
const TOP_THRESHOLD = 0.25; // lower fragment must start within top 25%

interface Fragment {
  table: OcrTable;
  page: number;
  top: number; // normalized 0..1
  bottom: number; // normalized 0..1
  header: string[][];
  rows: string[][];
  headerKey: string;
}

interface Working extends StitchedTable {
  lastPage: number;
  lastBottom: number;
  headerKey: string;
}

export function stitchTables(pages: OcrPage[]): StitchedTable[] {
  const pageByNumber = new Map(pages.map((p) => [p.pageNumber, p]));

  // 1) Flatten every table into a normalized fragment, in document order.
  const fragments: Fragment[] = [];
  for (const page of pages) {
    const ordered = [...page.tables].sort((a, b) => fragmentTop(a, page) - fragmentTop(b, page));
    for (const table of ordered) {
      const { header, rows } = toMatrix(table);
      fragments.push({
        table,
        page: page.pageNumber,
        top: fragmentTop(table, page),
        bottom: fragmentBottom(table, page),
        header,
        rows,
        headerKey: matrixKey(header),
      });
    }
  }

  // 2) Greedily attach each fragment to a compatible open table, else open new.
  const open: Working[] = [];
  let counter = 0;

  for (const frag of fragments) {
    const target = open.find((w) => isContinuation(w, frag, pageByNumber));

    if (target) {
      const score = anchorMatchScore(target.columnAnchors, frag.table.columnAnchors);
      // Drop a repeated header on the continuation fragment.
      const dataRows =
        frag.header.length > 0 && headersEqual(frag.headerKey, target.headerKey)
          ? frag.rows
          : [...frag.header, ...frag.rows]; // header didn't repeat → it's real data

      target.rows.push(...dataRows);
      target.sourcePages.push(frag.page);
      target.lastPage = frag.page;
      target.lastBottom = frag.bottom;
      target.confidence = Math.min(target.confidence, frag.table.confidence);
      target.stitched = true;
      if (score < ANCHOR_STRONG_MATCH) {
        target.warnings.push(
          `Stitched page ${frag.page} with ambiguous column alignment (match ${(score * 100).toFixed(0)}%).`
        );
      }
    } else {
      const w: Working = {
        id: `tbl_p${frag.page}_${counter++}`,
        columnCount: frag.table.columnCount,
        header: frag.header,
        rows: frag.rows,
        sourcePages: [frag.page],
        columnAnchors: frag.table.columnAnchors,
        confidence: frag.table.confidence,
        stitched: false,
        warnings: [],
        lastPage: frag.page,
        lastBottom: frag.bottom,
        headerKey: frag.headerKey,
      };
      open.push(w);
    }
  }

  // 3) Strip internal bookkeeping.
  return open.map(({ lastPage: _lp, lastBottom: _lb, headerKey: _hk, ...rest }) => rest);
}

// ── continuation logic ────────────────────────────────────────────────────────

function isContinuation(open: Working, frag: Fragment, _pages: Map<number, OcrPage>): boolean {
  if (frag.page !== open.lastPage + 1) return false; // 1: adjacency
  if (frag.table.columnCount !== open.columnCount) return false; // 2: equal columns
  if (open.lastBottom < BOTTOM_THRESHOLD) return false; // 4: upper ends near bottom
  if (frag.top > TOP_THRESHOLD) return false; // 5: lower starts near top
  return anchorMatchScore(open.columnAnchors, frag.table.columnAnchors) >= ANCHOR_MIN_MATCH; // 3
}

/** Fraction of columns whose normalized x-anchors agree within tolerance. */
function anchorMatchScore(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let matches = 0;
  for (let i = 0; i < n; i++) if (Math.abs(a[i] - b[i]) <= ANCHOR_TOLERANCE) matches++;
  return matches / n;
}

// ── matrix construction ───────────────────────────────────────────────────────

/** Build header + data row matrices from a table's cells. Header = rows containing any columnHeader cell. */
function toMatrix(table: OcrTable): { header: string[][]; rows: string[][] } {
  const grid: string[][] = Array.from({ length: table.rowCount }, () =>
    Array.from({ length: table.columnCount }, () => "")
  );
  const headerRowSet = new Set<number>();

  for (const cell of table.cells) {
    if (cell.rowIndex >= table.rowCount || cell.columnIndex >= table.columnCount) continue;
    const text = normalizeCell(cell.content);
    grid[cell.rowIndex][cell.columnIndex] = text;
    if (cell.kind === "columnHeader") headerRowSet.add(cell.rowIndex);
  }

  const header: string[][] = [];
  const rows: string[][] = [];
  grid.forEach((row, idx) => (headerRowSet.has(idx) ? header.push(row) : rows.push(row)));
  return { header, rows };
}

function matrixKey(matrix: string[][]): string {
  return matrix.map((r) => r.map((c) => c.toLowerCase()).join("|")).join("¶");
}
function headersEqual(a: string, b: string): boolean {
  return a !== "" && a === b;
}
function normalizeCell(s: string): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

// ── geometry ──────────────────────────────────────────────────────────────────

function fragmentTop(table: OcrTable, page: OcrPage): number {
  return verticalExtent(table).minY / (page.height || 1);
}
function fragmentBottom(table: OcrTable, page: OcrPage): number {
  return verticalExtent(table).maxY / (page.height || 1);
}
function verticalExtent(table: OcrTable): { minY: number; maxY: number } {
  if (table.polygon && table.polygon.length >= 4) {
    const b = bbox(table.polygon);
    return { minY: b.minY, maxY: b.maxY };
  }
  let minY = Infinity;
  let maxY = -Infinity;
  for (const cell of table.cells) {
    if (!cell.polygon || cell.polygon.length < 4) continue;
    const b = bbox(cell.polygon as Polygon);
    if (b.minY < minY) minY = b.minY;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  if (minY === Infinity) return { minY: 0, maxY: 0 };
  return { minY, maxY };
}
