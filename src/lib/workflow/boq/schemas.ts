/**
 * Zod trust boundaries for the BOQ/RFP workflow.
 *
 * These schemas are the ONLY shapes that cross between modules. The LLM may
 * only ever return `BoqExtraction` / `ComplianceMatrix`; the deterministic
 * engine only ever accepts a re-validated `BoqExtraction`. Nothing the model
 * emits is trusted until it has passed through one of these.
 */

import { z } from "zod";

// ── Extraction (LLM output) ───────────────────────────────────────────────────

export const BoqLineItemSchema = z.object({
  item_code: z.string().min(1),
  description: z.string(),
  unit_of_measurement: z.string(),
  // The model returns a number or null — NEVER a computed total. null = "not
  // printed"; the deterministic engine will flag it as INVALID_QUANTITY.
  quantity: z.number().finite().nullable(),
});

export const BoqExtractionSchema = z.object({
  line_items: z.array(BoqLineItemSchema),
  source_currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/)
    .optional(),
});

export type BoqExtractionParsed = z.infer<typeof BoqExtractionSchema>;

// ── Pricing config ────────────────────────────────────────────────────────────

export const PricingConfigSchema = z.object({
  overhead_markup_pct: z.number().min(0).max(1000),
  profit_margin_pct: z.number().min(0).max(1000),
  currency: z.string().regex(/^[A-Za-z]{3}$/),
  currency_minor_decimals: z.number().int().min(0).max(6).optional(),
});

// ── Compliance (RAG-grounded LLM output) ──────────────────────────────────────

export const ComplianceItemSchema = z.object({
  requirement: z.string(),
  status: z.enum(["COMPLIANT", "PARTIAL", "GAP", "UNKNOWN"]),
  risk: z.enum(["LOW", "MEDIUM", "HIGH"]),
  rationale: z.string(),
  /** Titles of the company documents that support the verdict. */
  evidence: z.array(z.string()).default([]),
});

export const ComplianceMatrixSchema = z.object({
  items: z.array(ComplianceItemSchema),
});

export type ComplianceItem = z.infer<typeof ComplianceItemSchema>;

// ── Workflow trigger input ────────────────────────────────────────────────────

export const WorkflowInputSchema = z.object({
  sourceText: z.string().min(1).max(200_000),
  requirements: z.array(z.string().min(1)).max(500).optional(),
  config: PricingConfigSchema,
  tenderId: z.string().optional(),
});
