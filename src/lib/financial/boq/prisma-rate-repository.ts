/**
 * Production rate repository — Prisma + Neon Postgres.
 *
 * Implements the `RateRepository` port against the `rate_catalogue_items` table.
 * Org-scoped (multi-tenant) and precision-safe: the Decimal `unitCost` is passed
 * to the money engine as a STRING so no float conversion ever happens.
 */

import { db } from "@/lib/prisma";
import type { RateSourceType } from "@prisma/client";
import type { RateRecord, RateSource } from "./types";
import { RateRepository, normalizeUnit } from "./rates-repository";

/** Map the DB enum to the public RateRecord.source labels. */
const SOURCE_LABEL: Record<RateSourceType, RateSource> = {
  LABOR: "labor_rates",
  MATERIAL: "material_costs",
};

export class PrismaRateRepository implements RateRepository {
  constructor(private readonly orgId: string) {}

  async getRatesForItemCodes(itemCodes: string[]): Promise<Map<string, RateRecord>> {
    const out = new Map<string, RateRecord>();
    if (itemCodes.length === 0) return out;

    // Single batched, org-scoped query (no N+1).
    const rows = await db.rateCatalogueItem.findMany({
      where: {
        orgId: this.orgId,
        itemCode: { in: [...new Set(itemCodes)] },
        deletedAt: null,
      },
      select: {
        itemCode: true,
        unitOfMeasurement: true,
        unitCost: true, // Prisma Decimal
        currency: true,
        source: true,
        effectiveFrom: true,
      },
    });

    for (const r of rows) {
      out.set(r.itemCode, {
        item_code: r.itemCode,
        unit_of_measurement: normalizeUnit(r.unitOfMeasurement),
        unit_cost: r.unitCost.toString(), // Decimal -> exact decimal string (no float)
        currency: r.currency,
        source: SOURCE_LABEL[r.source],
        effective_from: r.effectiveFrom?.toISOString(),
      });
    }
    return out;
  }
}

// ── Catalogue maintenance helper (admin / import) ─────────────────────────────

export interface UpsertRateInput {
  itemCode: string;
  description?: string;
  unitOfMeasurement: string;
  /** Major currency units. Pass a string to preserve Decimal precision. */
  unitCost: number | string;
  currency?: string;
  source: RateSourceType;
  effectiveFrom?: Date;
  createdById?: string;
}

/** Upsert internal rates for an org. Returns the number of rows written. */
export async function upsertRates(orgId: string, rates: UpsertRateInput[]): Promise<number> {
  let written = 0;
  for (const r of rates) {
    const data = {
      description: r.description ?? null,
      unitOfMeasurement: normalizeUnit(r.unitOfMeasurement),
      unitCost: r.unitCost.toString(),
      currency: (r.currency ?? "SAR").toUpperCase(),
      source: r.source,
      effectiveFrom: r.effectiveFrom ?? null,
    };
    await db.rateCatalogueItem.upsert({
      where: { orgId_itemCode: { orgId, itemCode: r.itemCode } },
      create: { orgId, itemCode: r.itemCode, createdById: r.createdById ?? null, ...data },
      update: { ...data, deletedAt: null },
    });
    written++;
  }
  return written;
}
