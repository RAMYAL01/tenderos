/**
 * Deliverable 2 — Extraction Agent (LLM).
 *
 * Vercel AI SDK `generateObject` + Claude, forced into a strict zod schema.
 * The model's ONLY job is to lift {item_code, description, unit, quantity} out
 * of messy BOQ text. It is explicitly forbidden from any arithmetic or price —
 * the system prompt (shared with the legacy tool-use extractor) enforces this,
 * and the deterministic engine downstream would discard any number it invented.
 *
 * Note: forced-schema `generateObject` is the SDK-native equivalent of the
 * existing Anthropic tool-use extractor; we reuse the same hardened prompt so
 * behaviour is identical and there is a single source of truth for the rules.
 */

import { generateObject } from "ai";
import { getChatModel } from "@/lib/ai/llm-provider";
import { BOQ_EXTRACTION_SYSTEM_PROMPT } from "@/lib/financial/boq/extraction-prompt";
import type { BoqExtraction } from "@/lib/financial/boq/types";
import { BoqExtractionSchema } from "./schemas";

const MAX_SOURCE_CHARS = 60_000;

export async function extractBoq(rawBoqContent: string): Promise<BoqExtraction> {
  if (!rawBoqContent || !rawBoqContent.trim()) return { line_items: [] };

  const { object } = await generateObject({
    model: getChatModel(), // Claude (cloud) or local vLLM — see LLM_PROVIDER
    schema: BoqExtractionSchema,
    schemaName: "boq_line_items",
    schemaDescription: "Extracted BOQ line items. Contains NO prices and NO calculations.",
    temperature: 0, // deterministic extraction
    maxRetries: 2,
    system: BOQ_EXTRACTION_SYSTEM_PROMPT,
    prompt:
      "Extract the BOQ line items from the document below. Remember: no prices, no math.\n\n" +
      `<boq_document>\n${rawBoqContent.slice(0, MAX_SOURCE_CHARS)}\n</boq_document>`,
  });

  // Trust boundary: re-shape into the engine's contract. A null/non-finite
  // quantity becomes NaN so the deterministic engine emits INVALID_QUANTITY
  // (a flagged, inspectable failure) rather than silently dropping the row.
  return {
    source_currency: object.source_currency,
    line_items: object.line_items
      .filter((li) => typeof li.item_code === "string" && li.item_code.trim().length > 0)
      .map((li) => ({
        item_code: li.item_code.trim(),
        description: (li.description ?? "").trim(),
        unit_of_measurement: (li.unit_of_measurement ?? "").trim(),
        quantity:
          typeof li.quantity === "number" && Number.isFinite(li.quantity)
            ? li.quantity
            : Number.NaN,
      })),
  };
}
