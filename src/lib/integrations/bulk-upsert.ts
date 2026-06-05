/**
 * High-performance, idempotent bulk upsert for Neon.
 *
 * Prisma has no native bulk upsert, and 10k individual `upsert()` calls would be
 * thousands of round-trips. Instead we issue chunked multi-row
 * `INSERT ... ON CONFLICT (natural_key) DO UPDATE` statements with BOUND
 * parameters (injection-safe). This makes a 10,000-row import a couple of dozen
 * statements, and it is idempotent: re-sending the same catalogue updates rows
 * in place — no duplicates, no unique-constraint errors.
 *
 * `RETURNING (xmax = 0)` distinguishes inserts (xmax 0) from updates, so we can
 * report exact counts.
 */

import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import type { MaterialImportRow, UpsertCounts, VendorImportRow } from "./types";

// Rows per statement. ~13 cols × 500 ≈ 6,500 bound params — well under PG's 65,535.
const CHUNK = 500;

function newId(): string {
  return crypto.randomUUID();
}

function* chunks<T>(arr: T[], size: number): Generator<T[]> {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}

// ── Vendors ───────────────────────────────────────────────────────────────────

export async function bulkUpsertVendors(orgId: string, rows: VendorImportRow[]): Promise<UpsertCounts> {
  const counts: UpsertCounts = { inserted: 0, updated: 0 };
  if (rows.length === 0) return counts;

  for (const batch of chunks(rows, CHUNK)) {
    const tuples = batch.map(
      (r) => Prisma.sql`(
        ${newId()}, ${orgId}, ${r.code}, ${r.externalId ?? null}, ${r.name},
        ${r.taxId ?? null}, ${r.email ?? null}, ${r.phone ?? null}, ${r.countryCode ?? null},
        ${(r.status ?? "ACTIVE") as string}::"VendorStatus",
        ${JSON.stringify(r.metadata ?? {})}::jsonb, now(), now()
      )`
    );

    const result = await db.$queryRaw<Array<{ inserted: boolean }>>(Prisma.sql`
      INSERT INTO vendors
        (id, "orgId", code, "externalId", name, "taxId", email, phone, "countryCode", status, metadata, "createdAt", "updatedAt")
      VALUES ${Prisma.join(tuples)}
      ON CONFLICT ("orgId", code) DO UPDATE SET
        "externalId"  = EXCLUDED."externalId",
        name          = EXCLUDED.name,
        "taxId"       = EXCLUDED."taxId",
        email         = EXCLUDED.email,
        phone         = EXCLUDED.phone,
        "countryCode" = EXCLUDED."countryCode",
        status        = EXCLUDED.status,
        metadata      = EXCLUDED.metadata,
        "updatedAt"   = now(),
        "deletedAt"   = NULL
      RETURNING (xmax = 0) AS inserted
    `);

    for (const r of result) {
      if (r.inserted) counts.inserted++;
      else counts.updated++;
    }
  }
  return counts;
}

// ── Materials (rate_catalogue_items) ──────────────────────────────────────────

export async function bulkUpsertMaterials(orgId: string, rows: MaterialImportRow[]): Promise<UpsertCounts> {
  const counts: UpsertCounts = { inserted: 0, updated: 0 };
  if (rows.length === 0) return counts;

  // Resolve vendorCode -> vendorId once for the whole batch (one query).
  const vendorMap = await resolveVendorIds(orgId, rows);

  for (const batch of chunks(rows, CHUNK)) {
    const tuples = batch.map((r) => {
      const vendorId = r.vendorCode ? vendorMap.get(r.vendorCode) ?? null : null;
      return Prisma.sql`(
        ${newId()}, ${orgId}, ${r.itemCode}, ${r.externalId ?? null}, ${vendorId},
        ${r.description ?? null}, ${r.unitOfMeasurement},
        ${r.unitCost}::decimal, ${r.currency}, ${r.source}::"RateSourceType",
        ${r.effectiveFrom ?? null}::timestamptz, now(), now()
      )`;
    });

    const result = await db.$queryRaw<Array<{ inserted: boolean }>>(Prisma.sql`
      INSERT INTO rate_catalogue_items
        (id, "orgId", "itemCode", "externalId", "vendorId", description, "unitOfMeasurement", "unitCost", currency, source, "effectiveFrom", "createdAt", "updatedAt")
      VALUES ${Prisma.join(tuples)}
      ON CONFLICT ("orgId", "itemCode") DO UPDATE SET
        "externalId"        = EXCLUDED."externalId",
        "vendorId"          = EXCLUDED."vendorId",
        description         = EXCLUDED.description,
        "unitOfMeasurement" = EXCLUDED."unitOfMeasurement",
        "unitCost"          = EXCLUDED."unitCost",
        currency            = EXCLUDED.currency,
        source              = EXCLUDED.source,
        "effectiveFrom"     = EXCLUDED."effectiveFrom",
        "updatedAt"         = now(),
        "deletedAt"         = NULL
      RETURNING (xmax = 0) AS inserted
    `);

    for (const r of result) {
      if (r.inserted) counts.inserted++;
      else counts.updated++;
    }
  }
  return counts;
}

async function resolveVendorIds(orgId: string, rows: MaterialImportRow[]): Promise<Map<string, string>> {
  const codes = [...new Set(rows.map((r) => r.vendorCode).filter((c): c is string => !!c))];
  if (codes.length === 0) return new Map();
  const vendors = await db.vendor.findMany({
    where: { orgId, code: { in: codes }, deletedAt: null },
    select: { id: true, code: true },
  });
  return new Map(vendors.map((v) => [v.code, v.id]));
}
