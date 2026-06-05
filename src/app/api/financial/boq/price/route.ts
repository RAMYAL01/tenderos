/**
 * POST /api/financial/boq/price
 *
 * The deployable serverless entry point for the hybrid BOQ pipeline.
 *   - Part 1 (AI): if `raw_boq` text is supplied, Claude extracts structured
 *     line items. If pre-extracted `line_items` are supplied, extraction is
 *     skipped (the AI layer is fully optional/decoupled).
 *   - Part 2 (deterministic): the calculation engine prices the items against
 *     the (mocked) Supabase rate catalogue and returns priced lines + totals.
 *
 * Body:
 *   {
 *     "raw_boq"?: string,                       // unstructured BOQ text/PDF text
 *     "line_items"?: ExtractedBoqLineItem[],    // OR pre-extracted items
 *     "config": { overhead_markup_pct, profit_margin_pct, currency, currency_minor_decimals? }
 *   }
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { extractBoqLineItems } from "@/lib/financial/boq/extraction-prompt";
import { priceBoq } from "@/lib/financial/boq/calculate-boq";
import { MockSupabaseRateRepository } from "@/lib/financial/boq/rates-repository";
import { BoqPricingError } from "@/lib/financial/boq/errors";
import type { BoqExtraction, ExtractedBoqLineItem, PricingConfig } from "@/lib/financial/boq/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  // Auth guard — extraction calls a paid LLM, so never leave this open.
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: {
    raw_boq?: string;
    line_items?: ExtractedBoqLineItem[];
    config?: PricingConfig;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_JSON", message: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body.config) {
    return NextResponse.json(
      { error: "INVALID_CONFIG", message: "A `config` object (overhead_markup_pct, profit_margin_pct, currency) is required." },
      { status: 400 }
    );
  }

  try {
    // Part 1: use supplied items, or extract from raw text.
    const extraction: BoqExtraction = Array.isArray(body.line_items)
      ? { line_items: body.line_items }
      : await extractBoqLineItems(body.raw_boq ?? "");

    // Part 2: deterministic pricing. Swap the repo for SupabaseRateRepository in prod.
    const repo = new MockSupabaseRateRepository();
    const result = await priceBoq(extraction, body.config, repo);

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BoqPricingError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    console.error("[boq/price] error:", err);
    return NextResponse.json(
      { error: "INTERNAL", message: err instanceof Error ? err.message : "BOQ pricing failed." },
      { status: 500 }
    );
  }
}
