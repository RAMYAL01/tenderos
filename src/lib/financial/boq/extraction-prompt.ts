/**
 * Part 1 — The LLM Extraction Layer.
 *
 * The LLM's ONLY job is to turn unstructured BOQ text/PDF content into a
 * structured array of {item_code, description, unit_of_measurement, quantity}.
 * It is explicitly forbidden from doing any arithmetic or emitting any price.
 * Structured output is forced via Claude tool-use (a schema the model MUST fill).
 */

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODELS, withRetry } from "@/lib/ai/client";
import type { BoqExtraction, ExtractedBoqLineItem } from "./types";

// ── The strict system prompt ──────────────────────────────────────────────────

export const BOQ_EXTRACTION_SYSTEM_PROMPT = `You are a Bill of Quantities (BOQ) EXTRACTION ENGINE for a construction and facilities-management tendering platform. You convert raw, messy BOQ tables (from PDFs, spreadsheets, or OCR'd scans, in English or Arabic) into a clean, structured list of line items.

# YOUR SINGLE JOB
Extract every BOQ line item as structured data with EXACTLY these four fields:
- item_code: the BOQ reference / item number exactly as printed (e.g. "2.1.4", "A-12", "L-FM-01"). If a row has no code, synthesize a stable sequential one of the form "ROW-001", "ROW-002", ...
- description: the work/material description, trimmed to a single line. Preserve the original language (do NOT translate).
- unit_of_measurement: the unit of measure as a short token (e.g. "m2", "m3", "no", "hr", "ls", "ton", "kg"). Normalize obvious variants (m², SQM -> m2; Nr, Nos -> no; L.S -> ls). If absent, use "".
- quantity: the numeric quantity for the row, as a NUMBER. Strip thousands separators (1,250 -> 1250). If the quantity is not explicitly printed for a row, set quantity to null. NEVER invent one.

# ABSOLUTE RULES — READ CAREFULLY
1. YOU ARE AN EXTRACTOR, NOT A CALCULATOR. You MUST NEVER perform arithmetic of any kind — no multiplication, addition, subtotalling, tax, VAT, rounding, or unit conversion.
2. YOU MUST NEVER OUTPUT A PRICE. Ignore and discard every monetary value in the source: unit rates, amounts, line totals, subtotals, VAT, grand totals, currency figures. These fields do not exist in your output. If a column looks like a price, skip it entirely.
3. YOU MUST NEVER GUESS, INFER, ESTIMATE, OR FABRICATE a quantity, code, unit, or description. Missing quantity -> null. Missing unit -> "". Do not "fill in" plausible values.
4. DO NOT deduplicate, merge, reorder, or summarize rows. One source line item = one output object, in document order.
5. DO NOT extract headers, section titles, page numbers, notes, preamble, or signature blocks as line items. Only rows that represent a measurable item of work or material.
6. If the document contains NO BOQ line items, return an empty array. Do not apologize or explain — just return the empty structure.

# OUTPUT
Call the tool \`emit_boq_line_items\` exactly once with the full array. Output nothing else — no prose, no markdown, no commentary. Pricing is handled by a separate deterministic engine; your numbers (other than quantity) would be discarded anyway.`;

// ── Forced-structure tool (Claude must fill this schema) ──────────────────────

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: "emit_boq_line_items",
  description:
    "Return the BOQ line items extracted from the document. Contains NO prices and NO calculations.",
  input_schema: {
    type: "object",
    properties: {
      line_items: {
        type: "array",
        description: "Every BOQ line item, in document order.",
        items: {
          type: "object",
          properties: {
            item_code: { type: "string", description: "BOQ reference as printed, e.g. '2.1.4'." },
            description: { type: "string", description: "Single-line work/material description." },
            unit_of_measurement: { type: "string", description: "Unit token, e.g. 'm2', 'no', 'hr', 'ls'. '' if absent." },
            quantity: {
              type: ["number", "null"],
              description: "Numeric quantity, or null if not explicitly stated. NEVER invented.",
            },
          },
          required: ["item_code", "description", "unit_of_measurement", "quantity"],
          additionalProperties: false,
        },
      },
    },
    required: ["line_items"],
    additionalProperties: false,
  },
};

interface RawExtractedItem {
  item_code?: unknown;
  description?: unknown;
  unit_of_measurement?: unknown;
  quantity?: unknown;
}

/**
 * Run Part 1: extract structured BOQ line items from raw text using Claude.
 *
 * Deterministic by design: temperature 0 + forced tool-use. The result is
 * sanitized — any item with a non-numeric/null quantity is kept but assigned
 * NaN so the deterministic engine flags it as INVALID_QUANTITY rather than
 * silently dropping a row.
 */
export async function extractBoqLineItems(
  rawBoqContent: string,
  opts: { model?: string; maxTokens?: number } = {}
): Promise<BoqExtraction> {
  if (!rawBoqContent || !rawBoqContent.trim()) {
    return { line_items: [] };
  }

  const client = getAnthropic();
  const response = await withRetry(() =>
    client.messages.create({
      model: opts.model ?? MODELS.CLAUDE_HAIKU, // fast + cheap; extraction needs no reasoning headroom
      max_tokens: opts.maxTokens ?? 8000,
      temperature: 0, // deterministic extraction
      system: BOQ_EXTRACTION_SYSTEM_PROMPT,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: "emit_boq_line_items" },
      messages: [
        {
          role: "user",
          content: `Extract the BOQ line items from the document below. Remember: no prices, no math.\n\n<boq_document>\n${rawBoqContent}\n</boq_document>`,
        },
      ],
    })
  );

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("BOQ extraction failed: model did not return structured tool output.");
  }

  const raw = (toolUse.input ?? {}) as { line_items?: RawExtractedItem[] };
  const line_items: ExtractedBoqLineItem[] = (raw.line_items ?? [])
    .filter((li): li is RawExtractedItem => !!li && typeof li.item_code === "string")
    .map((li) => ({
      item_code: String(li.item_code).trim(),
      description: typeof li.description === "string" ? li.description.trim() : "",
      unit_of_measurement: typeof li.unit_of_measurement === "string" ? li.unit_of_measurement.trim() : "",
      // null / missing / non-numeric -> NaN, so the calc engine emits INVALID_QUANTITY
      quantity: typeof li.quantity === "number" && Number.isFinite(li.quantity) ? li.quantity : Number.NaN,
    }));

  return { line_items };
}
