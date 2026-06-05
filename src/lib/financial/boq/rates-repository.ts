/**
 * Rate catalogue data-access layer (the "internal cost" source of truth).
 *
 * `RateRepository` is a PORT so the calculation engine never knows where rates
 * come from. Two adapters implement it:
 *   - `InMemoryRateRepository` (below) — seeded fixtures for local dev / tests.
 *   - `PrismaRateRepository` (./prisma-rate-repository) — production, backed by
 *     Prisma + Neon Postgres (the `rate_catalogue_items` table).
 */

import type { RateRecord, UnitOfMeasurement } from "./types";

/** Data-access port. */
export interface RateRepository {
  /**
   * Resolve internal unit costs for a set of BOQ item codes in ONE batch.
   * Returns a map keyed by the ORIGINAL item_code; missing codes are absent
   * (the caller turns absence into a RATE_NOT_FOUND line error).
   */
  getRatesForItemCodes(itemCodes: string[]): Promise<Map<string, RateRecord>>;
}

/**
 * Canonicalize a unit string so "M2", "m²", "sqm", "sq m" all compare equal.
 * Used both when seeding rates and when matching a BOQ line's unit to its rate.
 */
export function normalizeUnit(unit: string): UnitOfMeasurement {
  const u = unit.trim().toLowerCase().replace(/\s+/g, "").replace("²", "2").replace("³", "3");
  const aliases: Record<string, string> = {
    sqm: "m2",
    "sq.m": "m2",
    cum: "m3",
    "cu.m": "m3",
    nos: "no",
    each: "no",
    ea: "no",
    lumpsum: "ls",
    "l.s": "ls",
    hour: "hr",
    hrs: "hr",
    tonne: "ton",
    mt: "ton",
  };
  return aliases[u] ?? u;
}

// ── Seed catalogue (mocked Supabase tables) ───────────────────────────────────

const LABOR_RATES: RateRecord[] = [
  { item_code: "L-FM-01", unit_of_measurement: "hr", unit_cost: 38.5, currency: "SAR", source: "labor_rates" },
  { item_code: "L-FM-02", unit_of_measurement: "hr", unit_cost: 22.0, currency: "SAR", source: "labor_rates" },
  { item_code: "L-CV-07", unit_of_measurement: "hr", unit_cost: 55.75, currency: "SAR", source: "labor_rates" },
];

const MATERIAL_COSTS: RateRecord[] = [
  { item_code: "2.1.4", unit_of_measurement: "m2", unit_cost: 45.75, currency: "SAR", source: "material_costs" },
  { item_code: "2.2.1", unit_of_measurement: "m3", unit_cost: 310.0, currency: "SAR", source: "material_costs" },
  { item_code: "3.4.9", unit_of_measurement: "ton", unit_cost: 1875.333, currency: "SAR", source: "material_costs" },
  { item_code: "4.0.0", unit_of_measurement: "ls", unit_cost: 12500.0, currency: "SAR", source: "material_costs" },
  { item_code: "5.1.2", unit_of_measurement: "no", unit_cost: 9.99, currency: "SAR", source: "material_costs" },
];

/** In-memory adapter. Deterministic, no I/O — for local dev and unit tests. */
export class InMemoryRateRepository implements RateRepository {
  private readonly index = new Map<string, RateRecord>();

  constructor(seed: RateRecord[] = [...LABOR_RATES, ...MATERIAL_COSTS]) {
    for (const r of seed) {
      this.index.set(this.key(r.item_code), {
        ...r,
        unit_of_measurement: normalizeUnit(r.unit_of_measurement),
      });
    }
  }

  async getRatesForItemCodes(itemCodes: string[]): Promise<Map<string, RateRecord>> {
    const out = new Map<string, RateRecord>();
    for (const code of itemCodes) {
      const rec = this.index.get(this.key(code));
      if (rec) out.set(code, rec);
    }
    return out;
  }

  private key(itemCode: string): string {
    return itemCode.trim().toUpperCase();
  }
}
