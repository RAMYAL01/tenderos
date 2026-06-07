/**
 * Phase-3 training-data export.
 *
 * Materializes AIFeedback rows into versioned, DE-IDENTIFIED JSONL datasets:
 *   - SFT  (chat format): from ACCEPT/EDIT — input -> human-approved output.
 *   - DPO  (preference) : from EDIT       — chosen = human, rejected = ai.
 *
 * De-identification (mandatory for the shared corpus):
 *   - orgId/tenderId are HMAC'd (unlinkable, still groupable).
 *   - commercial secrets are scrubbed from free text: unit rates, prices,
 *     money amounts, emails, phone numbers, CR/IBAN-like tokens.
 * Prices never belong in training data anyway (the deterministic engine owns
 * pricing) — this is defense in depth.
 */

import { createHmac } from "node:crypto";
import { db } from "@/lib/prisma";
import type { AIFeedback } from "@prisma/client";

export interface ExportOptions {
  /** Only export rows for this org (per-tenant adapter). Omit for the cross-org shared corpus. */
  orgId?: string;
  /** Cap rows per run (serverless-safe). */
  limit?: number;
  /** Re-export rows already marked exported. Default false. */
  includeExported?: boolean;
}

export interface TrainingExport {
  sft: string[]; // JSONL lines (chat messages)
  dpo: string[]; // JSONL lines (prompt/chosen/rejected)
  rowIds: string[]; // AIFeedback ids included (so the caller can stamp exportedAt)
  counts: { rows: number; sft: number; dpo: number };
}

const HMAC_KEY = process.env.TRAINING_HMAC_KEY ?? process.env.INTERNAL_API_KEY ?? "tenderos-dev";

function hashId(value: string | null | undefined): string | null {
  if (!value) return null;
  return createHmac("sha256", HMAC_KEY).update(value).digest("hex").slice(0, 16);
}

/** Scrub commercial secrets / PII from free text used as model input. */
export function deidentifyText(text: string): string {
  if (!text) return text;
  return text
    // currency amounts: "SAR 1,250.00", "$1875.33", "12,500 SAR"
    .replace(/(?:SAR|USD|AED|QAR|EGP|﷼|\$|€|£)\s?[\d,]+(?:\.\d+)?/gi, "[AMOUNT]")
    .replace(/[\d,]+(?:\.\d+)?\s?(?:SAR|USD|AED|QAR|EGP|ريال|درهم)/gi, "[AMOUNT]")
    // emails / phones / long ID-ish tokens (CR, IBAN, etc.)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[EMAIL]")
    .replace(/(?:\+?\d[\d\s-]{7,}\d)/g, "[PHONE]")
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, "[IBAN]");
}

function redactJson<T>(value: T): T {
  // Drop any object key that looks like a price/rate/total/amount, recursively.
  const PRICE_KEY = /(price|rate|cost|amount|total|unit_cost|subtotal|vat|markup|margin)/i;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (PRICE_KEY.test(k)) continue; // commercial secret — never train on it
        out[k] = walk(val);
      }
      return out;
    }
    if (typeof v === "string") return deidentifyText(v);
    return v;
  };
  return walk(value) as T;
}

const SYSTEM_PROMPTS: Record<string, string> = {
  requirement_extraction:
    "You are a tender requirement extractor. Extract atomic mandatory/optional requirements with clause refs. Never invent requirements or quantities.",
  compliance_analysis:
    "You are a compliance analyst. Classify each requirement using ONLY the company evidence. No evidence = GAP. Cite evidence titles.",
  risk_identification:
    "You are a tender risk analyst. Identify contractual, financial, and schedule risks with severity and mitigation.",
  proposal_generation:
    "You are a senior proposal writer. Write specific, evidence-backed technical proposal prose grounded in the requirements and company evidence.",
  scope_interpretation:
    "You are a scope-of-work interpreter. Summarize what is included, excluded, and the duration.",
  boq_classification:
    "Classify the BOQ line into trade/division and cost driver. Extract code, description, unit, quantity. NEVER output a price or compute a total.",
};

function sftLine(row: AIFeedback): string | null {
  // The supervised target is the human-approved output (EDIT) or the accepted AI output (ACCEPT).
  const target = row.action === "EDIT" ? row.humanOutput : row.aiOutput;
  if (target == null || !row.inputText) return null;
  const example = {
    messages: [
      { role: "system", content: SYSTEM_PROMPTS[row.task] ?? "You are a tender-analysis assistant." },
      { role: "user", content: deidentifyText(row.inputText) },
      { role: "assistant", content: JSON.stringify(redactJson(target)) },
    ],
    meta: {
      task: row.task,
      lang: row.lang ?? "unknown",
      org: hashId(row.orgId),
      label_source: "human_corrected",
    },
  };
  return JSON.stringify(example);
}

function dpoLine(row: AIFeedback): string | null {
  // Preference signal: the human edit is preferred over the original AI draft.
  if (row.action !== "EDIT" || row.humanOutput == null || !row.inputText) return null;
  const example = {
    prompt: deidentifyText(row.inputText),
    chosen: JSON.stringify(redactJson(row.humanOutput)),
    rejected: JSON.stringify(redactJson(row.aiOutput)),
    meta: { task: row.task, lang: row.lang ?? "unknown", org: hashId(row.orgId) },
  };
  return JSON.stringify(example);
}

export async function buildTrainingExport(opts: ExportOptions = {}): Promise<TrainingExport> {
  const limit = Math.max(1, Math.min(opts.limit ?? 5000, 20_000));
  const rows = await db.aIFeedback.findMany({
    where: {
      ...(opts.orgId ? { orgId: opts.orgId } : {}),
      ...(opts.includeExported ? {} : { exportedAt: null }),
      action: { in: ["ACCEPT", "EDIT"] }, // REJECT handled as hard-negatives elsewhere
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const sft: string[] = [];
  const dpo: string[] = [];
  for (const row of rows) {
    const s = sftLine(row);
    if (s) sft.push(s);
    const d = dpoLine(row);
    if (d) dpo.push(d);
  }

  return {
    sft,
    dpo,
    rowIds: rows.map((r) => r.id),
    counts: { rows: rows.length, sft: sft.length, dpo: dpo.length },
  };
}

export interface TrainingStats {
  total: number;
  exportable: number; // ACCEPT + EDIT (have a supervised target)
  pending: number; // exportable AND not yet exported
  dpoPairs: number; // EDIT rows (chosen/rejected)
  byTask: Array<{ task: string; count: number }>;
  byLang: Array<{ lang: string; count: number }>;
  byAction: Array<{ action: string; count: number }>;
}

/** Corpus stats for the admin "Training Data" view. Tenant-scoped when orgId given. */
export async function getTrainingStats(orgId?: string): Promise<TrainingStats> {
  const where = orgId ? { orgId } : {};
  const [total, exportable, pending, dpoPairs, byTask, byLang, byAction] = await Promise.all([
    db.aIFeedback.count({ where }),
    db.aIFeedback.count({ where: { ...where, action: { in: ["ACCEPT", "EDIT"] } } }),
    db.aIFeedback.count({ where: { ...where, action: { in: ["ACCEPT", "EDIT"] }, exportedAt: null } }),
    db.aIFeedback.count({ where: { ...where, action: "EDIT" } }),
    db.aIFeedback.groupBy({ by: ["task"], where, _count: { _all: true } }),
    db.aIFeedback.groupBy({ by: ["lang"], where, _count: { _all: true } }),
    db.aIFeedback.groupBy({ by: ["action"], where, _count: { _all: true } }),
  ]);

  return {
    total,
    exportable,
    pending,
    dpoPairs,
    byTask: byTask.map((t) => ({ task: t.task, count: t._count._all })).sort((a, b) => b.count - a.count),
    byLang: byLang.map((l) => ({ lang: l.lang ?? "unknown", count: l._count._all })).sort((a, b) => b.count - a.count),
    byAction: byAction.map((a) => ({ action: a.action, count: a._count._all })),
  };
}

/** Mark rows as exported so the next dataset version doesn't double-count them. */
export async function markExported(rowIds: string[]): Promise<number> {
  if (rowIds.length === 0) return 0;
  const res = await db.aIFeedback.updateMany({
    where: { id: { in: rowIds } },
    data: { exportedAt: new Date() },
  });
  return res.count;
}
