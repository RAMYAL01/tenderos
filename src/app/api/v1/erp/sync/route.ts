/**
 * POST /api/v1/erp/sync
 *
 * Part 2 — the external ERP ingestion endpoint (SAP/Oracle → TenderOS).
 * Authenticated by a tenant-bound API key (Authorization: Bearer tk_live_...).
 * Idempotent: re-sending the same vendor/material catalogue upserts in place —
 * no duplicates, no unique-constraint errors.
 *
 * Body: { "vendors"?: [...], "materials"?: [...] }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiAuthError, authenticateErpRequest } from "@/lib/integrations/api-keys";
import { bulkUpsertMaterials, bulkUpsertVendors } from "@/lib/integrations/bulk-upsert";
import type { ErpSyncResponse, ImportResult } from "@/lib/integrations/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const vendorSchema = z.object({
  code: z.string().min(1),
  externalId: z.string().optional().nullable(),
  name: z.string().min(1),
  taxId: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  countryCode: z.string().length(2).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "BLACKLISTED"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const materialSchema = z.object({
  itemCode: z.string().min(1),
  externalId: z.string().optional().nullable(),
  vendorCode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  unitOfMeasurement: z.string().min(1),
  unitCost: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).replace(/,/g, "").trim())
    .refine((v) => /^\d+(\.\d+)?$/.test(v), "unitCost must be a positive number"),
  currency: z.string().regex(/^[A-Za-z]{3}$/).transform((v) => v.toUpperCase()).default("SAR"),
  source: z.enum(["LABOR", "MATERIAL"]).default("MATERIAL"),
  effectiveFrom: z.string().optional().nullable(),
});

const bodySchema = z.object({
  vendors: z.array(vendorSchema).max(50_000).optional(),
  materials: z.array(materialSchema).max(50_000).optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await authenticateErpRequest(req, "erp:write");

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", issues: parsed.error.issues.slice(0, 50) },
        { status: 422 }
      );
    }

    const results: ImportResult[] = [];

    if (parsed.data.vendors?.length) {
      const upserted = await bulkUpsertVendors(ctx.orgId, parsed.data.vendors);
      results.push(buildResult("vendor", parsed.data.vendors.length, upserted));
    }
    if (parsed.data.materials?.length) {
      const upserted = await bulkUpsertMaterials(ctx.orgId, parsed.data.materials);
      results.push(buildResult("material", parsed.data.materials.length, upserted));
    }

    const response: ErpSyncResponse = { ok: true, results };
    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: "AUTH", message: err.message }, { status: err.status });
    }
    console.error("[erp/sync] error:", err);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}

function buildResult(
  entity: ImportResult["entity"],
  total: number,
  upserted: ImportResult["upserted"]
): ImportResult {
  return { entity, totalRows: total, validRows: total, invalidRows: 0, upserted, errors: [] };
}
