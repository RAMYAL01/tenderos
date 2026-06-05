/**
 * Part 1 — The "Legacy Bridge": robust Excel/CSV importer.
 *
 * Parses an uploaded .xlsx/.csv, dynamically maps source columns to our internal
 * fields, validates EACH row with Zod, and bulk-upserts the valid rows. A single
 * bad row never aborts the import — invalid rows are collected into a detailed
 * error report so the user fixes only what's broken.
 *
 * Performance: a 10k-row sheet is parsed once into memory and upserted in chunked
 * multi-row statements (see bulk-upsert.ts). For >100k rows, swap the parse step
 * for a streaming CSV reader (papaparse) — the validate/upsert pipeline is
 * unchanged.
 */

import * as XLSX from "xlsx";
import { z } from "zod";
import { bulkUpsertMaterials, bulkUpsertVendors } from "./bulk-upsert";
import type {
  ImportResult,
  MaterialImportRow,
  RowError,
  VendorImportRow,
} from "./types";

export type ImportEntity = "vendor" | "material";

/** Maps an internal field name → the source column header chosen for it. */
export type ColumnMapping = Record<string, string>;

// ── Zod row schemas (validate + normalize) ────────────────────────────────────

const optStr = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const decimalString = z.preprocess(
  (v) => (typeof v === "number" ? String(v) : String(v ?? "").replace(/,/g, "").trim()),
  z.string().regex(/^\d+(\.\d+)?$/, "must be a positive number (no currency symbols)")
);

const vendorRowSchema = z.object({
  code: z.preprocess((v) => String(v ?? "").trim(), z.string().min(1, "vendor code is required")),
  externalId: optStr,
  name: z.preprocess((v) => String(v ?? "").trim(), z.string().min(1, "vendor name is required")),
  taxId: optStr,
  email: z
    .preprocess((v) => String(v ?? "").trim(), z.string())
    .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "invalid email")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  phone: optStr,
  countryCode: z
    .preprocess((v) => String(v ?? "").trim().toUpperCase(), z.string())
    .refine((v) => v === "" || v.length === 2, "country code must be 2 letters")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BLACKLISTED"]).optional(),
});

const materialRowSchema = z.object({
  itemCode: z.preprocess((v) => String(v ?? "").trim(), z.string().min(1, "item code is required")),
  externalId: optStr,
  vendorCode: optStr,
  description: optStr,
  unitOfMeasurement: z.preprocess((v) => String(v ?? "").trim(), z.string().min(1, "unit is required")),
  unitCost: decimalString,
  currency: z.preprocess(
    (v) => String(v ?? "SAR").trim().toUpperCase(),
    z.string().regex(/^[A-Z]{3}$/, "currency must be a 3-letter ISO code")
  ),
  source: z
    .preprocess((v) => String(v ?? "MATERIAL").trim().toUpperCase(), z.enum(["LABOR", "MATERIAL"]))
    .default("MATERIAL"),
  effectiveFrom: optStr,
});

// ── Auto column mapping (synonyms → internal field) ───────────────────────────

const SYNONYMS: Record<ImportEntity, Record<string, string[]>> = {
  vendor: {
    code: ["code", "vendor code", "vendor_code", "supplier code", "supplier id", "vendor id", "bp number"],
    externalId: ["external id", "erp id", "sap id", "reference"],
    name: ["name", "vendor name", "supplier name", "vendor", "company"],
    taxId: ["tax id", "vat", "vat number", "tax number", "trn"],
    email: ["email", "e-mail", "contact email"],
    phone: ["phone", "telephone", "mobile", "contact"],
    countryCode: ["country", "country code", "iso country"],
    status: ["status"],
  },
  material: {
    itemCode: ["item code", "code", "material code", "sku", "item", "boq code", "boq ref"],
    externalId: ["external id", "erp id", "material number"],
    vendorCode: ["vendor code", "supplier code", "vendor", "supplier"],
    description: ["description", "desc", "item description", "material"],
    unitOfMeasurement: ["unit", "uom", "unit of measure", "unit of measurement"],
    unitCost: ["unit cost", "cost", "rate", "unit price", "price", "unit rate"],
    currency: ["currency", "ccy"],
    source: ["source", "type", "category"],
    effectiveFrom: ["effective from", "effective date", "valid from", "date"],
  },
};

export function autoMapColumns(headers: string[], entity: ImportEntity): ColumnMapping {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, " ").trim();
  const headerByNorm = new Map(headers.map((h) => [norm(h), h]));
  const mapping: ColumnMapping = {};
  for (const [field, syns] of Object.entries(SYNONYMS[entity])) {
    for (const syn of syns) {
      const hit = headerByNorm.get(norm(syn));
      if (hit) {
        mapping[field] = hit;
        break;
      }
    }
  }
  return mapping;
}

// ── Parse ─────────────────────────────────────────────────────────────────────

interface ParsedSheet {
  headers: string[];
  rows: Record<string, unknown>[];
}

export function parseSpreadsheet(buffer: Buffer): ParsedSheet {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { headers: [], rows: [] };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
  if (matrix.length === 0) return { headers: [], rows: [] };

  const headers = (matrix[0] as unknown[]).map((h) => String(h ?? "").trim());
  const rows = matrix.slice(1).map((arr) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => (obj[h] = (arr as unknown[])[i]));
    return obj;
  });
  return { headers, rows };
}

// ── Orchestration ─────────────────────────────────────────────────────────────

export interface ImportInput {
  orgId: string;
  buffer: Buffer;
  entity: ImportEntity;
  /** Explicit mapping overrides; auto-mapping fills the rest. */
  mapping?: ColumnMapping;
}

export interface MapAndValidateResult {
  validVendors: VendorImportRow[];
  validMaterials: MaterialImportRow[];
  errors: RowError[];
  totalRows: number;
}

/**
 * PURE: map + Zod-validate parsed rows. A single bad row becomes an entry in
 * `errors` (not a thrown exception), so the rest of the file still imports.
 * Exported so it can be unit-tested without a database.
 */
export function mapAndValidate(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping,
  entity: ImportEntity
): MapAndValidateResult {
  const errors: RowError[] = [];
  const validVendors: VendorImportRow[] = [];
  const validMaterials: MaterialImportRow[] = [];
  let totalRows = 0;

  rows.forEach((raw, idx) => {
    const rowNumber = idx + 2; // header is row 1
    if (isBlankRow(raw)) return; // skip trailing blank lines silently
    totalRows++;

    const mapped = applyMapping(raw, mapping);
    if (entity === "vendor") {
      const parsed = vendorRowSchema.safeParse(mapped);
      if (parsed.success) validVendors.push(parsed.data as VendorImportRow);
      else pushZodErrors(errors, rowNumber, parsed.error, mapped);
    } else {
      const parsed = materialRowSchema.safeParse(mapped);
      if (parsed.success) validMaterials.push(parsed.data as MaterialImportRow);
      else pushZodErrors(errors, rowNumber, parsed.error, mapped);
    }
  });

  return { validVendors, validMaterials, errors, totalRows };
}

export async function importSpreadsheet(input: ImportInput): Promise<ImportResult> {
  const { orgId, buffer, entity } = input;
  const { headers, rows } = parseSpreadsheet(buffer);
  const mapping = { ...autoMapColumns(headers, entity), ...(input.mapping ?? {}) };

  const { validVendors, validMaterials, errors, totalRows } = mapAndValidate(rows, mapping, entity);

  const upserted =
    entity === "vendor"
      ? await bulkUpsertVendors(orgId, validVendors)
      : await bulkUpsertMaterials(orgId, validMaterials);

  return {
    entity,
    totalRows,
    validRows: entity === "vendor" ? validVendors.length : validMaterials.length,
    invalidRows: errors.length,
    upserted,
    errors,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function applyMapping(raw: Record<string, unknown>, mapping: ColumnMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [field, header] of Object.entries(mapping)) {
    out[field] = raw[header];
  }
  return out;
}

function isBlankRow(raw: Record<string, unknown>): boolean {
  return Object.values(raw).every((v) => v === "" || v === null || v === undefined);
}

function pushZodErrors(errors: RowError[], row: number, err: z.ZodError, mapped: Record<string, unknown>): void {
  for (const issue of err.issues) {
    const field = issue.path[0] != null ? String(issue.path[0]) : undefined;
    errors.push({ row, field, message: issue.message, rawValue: field ? mapped[field] : undefined });
  }
}
