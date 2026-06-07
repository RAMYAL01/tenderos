/**
 * Deliverable 4 — Deterministic Financial Router (Non-AI Math Engine).
 *
 * Pure TypeScript. NO LLM anywhere in this path. Takes the (re-validated)
 * extraction, looks up the org's approved unit rates from Prisma/Neon, and runs
 * the float-safe BigInt money engine to produce the final BOQ price.
 *
 * Determinism guarantees (inherited from lib/financial/boq):
 *   - all arithmetic is in integer minor units via BigInt (no IEEE-754 drift);
 *   - Decimal rates are read as strings (never float-converted);
 *   - a missing rate / unit mismatch / bad quantity is a flagged per-line error,
 *     never a silent zero.
 */

import { priceBoq } from "@/lib/financial/boq/calculate-boq";
import { PrismaRateRepository } from "@/lib/financial/boq/prisma-rate-repository";
import type { BoqExtraction, BoqPricingResult, PricingConfig } from "@/lib/financial/boq/types";
import { BoqExtractionSchema, PricingConfigSchema } from "./schemas";

/**
 * @param orgId      tenant — rate lookups are strictly scoped to this org.
 * @param extraction untrusted extraction payload (revalidated here).
 * @param config     pricing config (overhead %, profit %, currency).
 */
export async function runFinancialRouter(
  orgId: string,
  extraction: unknown,
  config: unknown
): Promise<BoqPricingResult> {
  if (!orgId) throw new Error("financialRouter: orgId is required");

  // 1. Re-validate the extraction at the trust boundary. Coerce any non-finite
  //    quantity to null first so it passes the schema, then to NaN for the
  //    engine (which flags it as INVALID_QUANTITY).
  const coerced = coerceQuantities(extraction);
  const parsedExtraction = BoqExtractionSchema.parse(coerced);
  const parsedConfig = PricingConfigSchema.parse(config) as PricingConfig;

  const engineInput: BoqExtraction = {
    source_currency: parsedExtraction.source_currency,
    line_items: parsedExtraction.line_items.map((li) => ({
      item_code: li.item_code,
      description: li.description,
      unit_of_measurement: li.unit_of_measurement,
      quantity: li.quantity == null ? Number.NaN : li.quantity,
    })),
  };

  // 2. Org-scoped rate repository + deterministic BigInt pricing. No AI.
  const repo = new PrismaRateRepository(orgId);
  return priceBoq(engineInput, parsedConfig, repo);
}

/** Map any non-finite/NaN quantity to null so the zod schema accepts it. */
function coerceQuantities(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const obj = input as { line_items?: unknown };
  if (!Array.isArray(obj.line_items)) return input;
  return {
    ...obj,
    line_items: obj.line_items.map((li) => {
      const item = (li ?? {}) as { quantity?: unknown };
      const q = item.quantity;
      return {
        ...item,
        quantity: typeof q === "number" && Number.isFinite(q) ? q : null,
      };
    }),
  };
}
