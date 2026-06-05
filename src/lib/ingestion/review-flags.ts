/**
 * Fault tolerance — confidence & consistency assessment.
 *
 * The pipeline must NEVER silently emit garbage. This stage inspects the OCR +
 * stitched output and emits structured review flags. Any BLOCKER pins the
 * document to NEEDS_REVIEW (a human resolves it); WARNINGs are surfaced but let
 * the document proceed.
 */

import { ReviewFlagSeverity, ReviewFlagType, DocumentStatus } from "@prisma/client";
import type { OcrResult } from "./ocr-types";
import type { StitchedTable } from "./stitch-tables";

export interface ReviewFlagInput {
  type: ReviewFlagType;
  severity: ReviewFlagSeverity;
  message: string;
  pageNumber?: number;
  tableIndex?: number;
  confidence?: number;
  context?: Record<string, unknown>;
}

export interface IngestionAssessment {
  flags: ReviewFlagInput[];
  recommendedStatus: DocumentStatus; // READY | NEEDS_REVIEW
  hasBlockers: boolean;
}

// Confidence thresholds (0..1).
const PAGE_CONF_WARN = 0.7;
const PAGE_CONF_BLOCK = 0.5;
const TABLE_CONF_WARN = 0.7;
const TABLE_CONF_BLOCK = 0.5;

export function assessIngestion(ocr: OcrResult, stitched: StitchedTable[]): IngestionAssessment {
  const flags: ReviewFlagInput[] = [];

  // 1) Whole page ranges that failed OCR → hard blockers (we have no data there).
  for (const range of ocr.failedPageRanges) {
    flags.push({
      type: ReviewFlagType.LOW_OCR_CONFIDENCE,
      severity: ReviewFlagSeverity.BLOCKER,
      message: `Pages ${range.start}-${range.end} failed OCR and were not read (${range.reason}).`,
      pageNumber: range.start,
      context: { range },
    });
  }

  // 2) Per-page confidence + emptiness + language signals.
  for (const page of ocr.pages) {
    if (page.words.length === 0) {
      flags.push({
        type: ReviewFlagType.EMPTY_PAGE,
        severity: ReviewFlagSeverity.WARNING,
        message: `Page ${page.pageNumber} produced no text — likely an image-only scan or blank page.`,
        pageNumber: page.pageNumber,
      });
      continue;
    }
    if (page.meanConfidence < PAGE_CONF_BLOCK) {
      flags.push({
        type: ReviewFlagType.LOW_OCR_CONFIDENCE,
        severity: ReviewFlagSeverity.BLOCKER,
        message: `Page ${page.pageNumber} OCR confidence is very low (${pct(page.meanConfidence)}).`,
        pageNumber: page.pageNumber,
        confidence: page.meanConfidence,
      });
    } else if (page.meanConfidence < PAGE_CONF_WARN) {
      flags.push({
        type: ReviewFlagType.LOW_OCR_CONFIDENCE,
        severity: ReviewFlagSeverity.WARNING,
        message: `Page ${page.pageNumber} OCR confidence is low (${pct(page.meanConfidence)}).`,
        pageNumber: page.pageNumber,
        confidence: page.meanConfidence,
      });
    }
    if (page.dominantDirection === "neutral" && page.words.length > 15) {
      flags.push({
        type: ReviewFlagType.LANGUAGE_DETECTION_LOW,
        severity: ReviewFlagSeverity.WARNING,
        message: `Page ${page.pageNumber} has text but no detectable Arabic/Latin script — check OCR quality.`,
        pageNumber: page.pageNumber,
      });
    }
  }

  // 3) Per stitched table — the highest-risk artifact for BOQs.
  stitched.forEach((table, index) => {
    const firstPage = table.sourcePages[0];

    if (table.confidence < TABLE_CONF_BLOCK) {
      flags.push({
        type: ReviewFlagType.UNREADABLE_TABLE,
        severity: ReviewFlagSeverity.BLOCKER,
        message: `Table ${table.id} (pages ${table.sourcePages.join(",")}) is unreadable (confidence ${pct(table.confidence)}).`,
        pageNumber: firstPage,
        tableIndex: index,
        confidence: table.confidence,
      });
    } else if (table.confidence < TABLE_CONF_WARN) {
      flags.push({
        type: ReviewFlagType.UNREADABLE_TABLE,
        severity: ReviewFlagSeverity.WARNING,
        message: `Table ${table.id} has low confidence (${pct(table.confidence)}); verify values before pricing.`,
        pageNumber: firstPage,
        tableIndex: index,
        confidence: table.confidence,
      });
    }

    // Column integrity: header width must equal the declared column count.
    const headerWidth = table.header[0]?.length;
    if (headerWidth !== undefined && headerWidth !== table.columnCount) {
      flags.push({
        type: ReviewFlagType.TABLE_COLUMN_MISMATCH,
        severity: ReviewFlagSeverity.WARNING,
        message: `Table ${table.id} header has ${headerWidth} columns but ${table.columnCount} were detected.`,
        pageNumber: firstPage,
        tableIndex: index,
      });
    }
    // Rows that are almost entirely empty suggest mis-segmented columns.
    const sparseRows = table.rows.filter((r) => r.filter((c) => c.trim() !== "").length <= 1).length;
    if (table.rows.length > 0 && sparseRows / table.rows.length > 0.3) {
      flags.push({
        type: ReviewFlagType.TABLE_COLUMN_MISMATCH,
        severity: ReviewFlagSeverity.WARNING,
        message: `Table ${table.id}: ${sparseRows}/${table.rows.length} rows are nearly empty — possible column segmentation error.`,
        pageNumber: firstPage,
        tableIndex: index,
      });
    }

    // Ambiguous cross-page stitching.
    for (const w of table.warnings) {
      flags.push({
        type: ReviewFlagType.STITCH_AMBIGUITY,
        severity: ReviewFlagSeverity.WARNING,
        message: `Table ${table.id}: ${w}`,
        pageNumber: firstPage,
        tableIndex: index,
      });
    }
  });

  const hasBlockers = flags.some((f) => f.severity === ReviewFlagSeverity.BLOCKER);
  return {
    flags,
    hasBlockers,
    recommendedStatus: hasBlockers ? DocumentStatus.NEEDS_REVIEW : DocumentStatus.READY,
  };
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
