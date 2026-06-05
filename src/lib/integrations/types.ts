/**
 * Strict interfaces for every external payload crossing the integration boundary
 * (imports, ERP sync, outbound webhooks). These are the contract — they never
 * leak Prisma internals and are versioned independently of the DB.
 */

import type { VendorStatus, RateSourceType } from "@prisma/client";

// ── Canonical import/sync rows (the normalized shape after mapping) ───────────

export interface VendorImportRow {
  code: string; // tenant-unique natural key
  externalId?: string | null;
  name: string;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  countryCode?: string | null;
  status?: VendorStatus;
  metadata?: Record<string, unknown>;
}

export interface MaterialImportRow {
  itemCode: string; // tenant-unique natural key
  externalId?: string | null;
  vendorCode?: string | null; // resolved to vendorId on upsert
  description?: string | null;
  unitOfMeasurement: string;
  unitCost: string; // decimal string — precision-safe (never a float)
  currency: string;
  source: RateSourceType; // LABOR | MATERIAL
  effectiveFrom?: string | null; // ISO date
}

// ── Import result + per-row error report ──────────────────────────────────────

export interface RowError {
  row: number; // 1-based source row number (header = row 1)
  field?: string;
  message: string;
  rawValue?: unknown;
}

export interface UpsertCounts {
  inserted: number;
  updated: number;
}

export interface ImportResult {
  entity: "vendor" | "material";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  upserted: UpsertCounts;
  errors: RowError[]; // detailed, so the user fixes only the bad rows
}

// ── ERP ingestion API ─────────────────────────────────────────────────────────

export interface ErpSyncRequest {
  vendors?: VendorImportRow[];
  materials?: MaterialImportRow[];
}

export interface ErpSyncResponse {
  ok: boolean;
  results: ImportResult[];
}

// ── Outbound webhook payloads ─────────────────────────────────────────────────

export type WebhookEventType = "tender.won" | "financial_proposal.finalized";

export interface WebhookEnvelope<T> {
  id: string; // delivery id (idempotency key for the receiver)
  event: WebhookEventType;
  created_at: string; // ISO
  tenant_id: string;
  data: T;
}

export interface TenderWonPayload {
  tender_id: string;
  reference_no: string | null;
  title: string;
  client_name: string | null;
  awarded_value: string | null; // decimal string
  currency: string | null;
}

export interface FinancialProposalFinalizedPayload {
  financial_proposal_id: string;
  tender_id: string;
  currency: string;
  total_price: string; // decimal string (deterministic engine output)
  line_items: Array<{
    item_ref: string | null;
    description: string;
    unit: string | null;
    quantity: string;
    unit_rate: string;
    line_total: string;
    vendor_code?: string | null;
  }>;
}

export type WebhookPayloadMap = {
  "tender.won": TenderWonPayload;
  "financial_proposal.finalized": FinancialProposalFinalizedPayload;
};
