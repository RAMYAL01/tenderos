/**
 * Part 2b — The "Zero-Training" Claude Proxy.
 *
 * DATA-RETENTION POSTURE (be precise — there is no magic "no-train" header):
 *   - The Anthropic API does NOT use API inputs/outputs to train models; that is
 *     the default under Anthropic's Commercial Terms. For a contractual hard
 *     guarantee, the account is enrolled in Zero Data Retention (ZDR), which is
 *     configured at the org/account level, not per request.
 *   - What THIS layer enforces in code:
 *       1. Identity minimization — we send only an OPAQUE, salted hash of the
 *          tenant id as `metadata.user_id` (never email/name/orgId in clear),
 *          so request metadata carries no tenant-identifying PII.
 *       2. Sensitive-data minimization — highly sensitive financial TOTALS are
 *          stripped from the prompt before it leaves our infrastructure.
 *       3. No local prompt persistence — we never log raw prompt content.
 *       4. An explicit policy header documenting intent in transit.
 */

import crypto from "node:crypto";
import { getAnthropic, MODELS } from "@/lib/ai/client";
import type { RagChunk } from "./rag-search";

const POLICY_HEADER = { "x-tenderos-data-policy": "zero-retention-no-training" } as const;
// Server-only salt so the opaque user_id cannot be reversed/correlated externally.
const ID_SALT = process.env.ANALYTICS_ID_SALT ?? "tenderos-static-salt";

export interface SecureCompletionInput {
  /** Tenant id — used ONLY to derive an opaque metadata id. Never sent in clear. */
  orgId: string;
  system: string;
  userContent: string;
  model?: string;
  maxTokens?: number;
  /** Strip sensitive financial totals from the prompt. Default true. */
  redactFinancials?: boolean;
}

export interface SecureCompletionResult {
  text: string;
  redactions: number;
}

export async function secureClaudeComplete(input: SecureCompletionInput): Promise<SecureCompletionResult> {
  const redactFinancials = input.redactFinancials ?? true;
  const { text: cleanContent, count } = redactFinancials
    ? redactFinancialTotals(input.userContent)
    : { text: input.userContent, count: 0 };

  const response = await getAnthropic().messages.create(
    {
      model: input.model ?? MODELS.CLAUDE_SONNET,
      max_tokens: input.maxTokens ?? 4000,
      system: input.system,
      // Opaque, non-reversible tenant identifier — no PII in request metadata.
      metadata: { user_id: opaqueTenantId(input.orgId) },
      messages: [{ role: "user", content: cleanContent }],
    },
    { headers: POLICY_HEADER }
  );

  const text = response.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  return { text, redactions: count };
}

/** Salted, truncated SHA-256 of the tenant id — stable but non-identifying. */
export function opaqueTenantId(orgId: string): string {
  return crypto.createHash("sha256").update(`${ID_SALT}:${orgId}`).digest("hex").slice(0, 32);
}

// ── Financial totals redaction ────────────────────────────────────────────────

const TOTAL_LABELS = [
  "grand\\s+total",
  "total\\s+price",
  "total\\s+amount",
  "total\\s+bid(?:\\s+price)?",
  "bid\\s+price",
  "contract\\s+(?:value|price|sum)",
  "net\\s+price",
  // Arabic
  "الإجمالي(?:\\s+الكلي)?",
  "السعر\\s+الإجمالي",
  "القيمة\\s+الإجمالية",
  "إجمالي\\s+(?:السعر|العطاء|القيمة)",
].join("|");

const CURRENCY = "(?:SAR|AED|USD|QAR|KWD|BHD|OMR|﷼|ر\\.?\\s?س|د\\.?\\s?إ)";

/**
 * Strip the most sensitive trade-secret numbers — the headline TOTALS / bid
 * prices — while leaving descriptive context intact. Two passes:
 *   1. amounts that directly follow a "total/price" label (EN + AR),
 *   2. currency-prefixed amounts of 5+ integer digits (>= 10,000), which in a
 *      BOQ are almost always totals/subtotals rather than unit rates.
 * Returns the redacted text and the number of values removed.
 */
export function redactFinancialTotals(text: string): { text: string; count: number } {
  let count = 0;

  // Pass 1: "<label> : <currency?> <amount>"
  const labeled = new RegExp(`((?:${TOTAL_LABELS})\\s*[:=\\-]?\\s*)(?:${CURRENCY}\\s*)?[\\d][\\d.,]*`, "gi");
  let out = text.replace(labeled, (_m, label: string) => {
    count++;
    return `${label}[REDACTED-TOTAL]`;
  });

  // Pass 2: large currency-prefixed amounts (>= 10,000).
  const largeAmount = new RegExp(`${CURRENCY}\\s*((?:\\d{1,3}(?:,\\d{3})+|\\d{5,})(?:\\.\\d+)?)`, "gi");
  out = out.replace(largeAmount, () => {
    count++;
    return "[REDACTED-AMOUNT]";
  });

  return { text: out, count };
}

// ── Tenant-scoped RAG context assembly (with redaction) ───────────────────────

/**
 * Build an LLM context block from tenant-scoped RAG chunks. Redaction is applied
 * again here as defense-in-depth, so even retrieved proposal text never exposes
 * totals to the model.
 */
export function buildSecureRagContext(chunks: RagChunk[]): string {
  if (chunks.length === 0) return "";
  const blocks = chunks.map((c, i) => {
    const { text } = redactFinancialTotals(c.snippet);
    return `[Source ${i + 1} — ${c.title} (similarity ${(c.similarity * 100).toFixed(0)}%)]\n${text}`;
  });
  return `Use ONLY the following of the company's own past materials as context:\n\n${blocks.join("\n\n")}`;
}
