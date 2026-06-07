/**
 * Deliverable 3 — Compliance Agent (RAG-enabled LLM).
 *
 * For each extracted technical requirement, retrieve the company's own evidence
 * from the Phase-1 tenant-isolated corpus (tenantChunkSearch — pre-filtered by
 * orgId in SQL) and have Claude classify compliance grounded ONLY in that
 * evidence. The model never sees another tenant's data, and it is instructed
 * not to use outside knowledge — a requirement with no matching evidence is a
 * GAP, not a guess.
 */

import { generateObject } from "ai";
import { getChatModel } from "@/lib/ai/llm-provider";
import { embedQuery } from "@/lib/ai/embedding-provider";
import { tenantChunkSearch } from "@/lib/security/rag-search";
import { ComplianceMatrixSchema, type ComplianceItem } from "./schemas";

const REQS_PER_BATCH = 6; // bound the context window per LLM call
const EVIDENCE_PER_REQ = 4;

const SYSTEM = `You are a tender COMPLIANCE ANALYST. For each technical requirement you are given the company's own evidence excerpts (retrieved from its internal documents). Classify how well the company meets each requirement.

RULES:
- Use ONLY the provided evidence excerpts. Do NOT use outside knowledge or assume capabilities that are not evidenced.
- status: COMPLIANT (evidence clearly satisfies it), PARTIAL (some but incomplete evidence), GAP (no supporting evidence), UNKNOWN (ambiguous).
- risk: HIGH for an unmet mandatory-sounding requirement, MEDIUM for partial, LOW when well-evidenced.
- rationale: one or two sentences, citing what the evidence shows (or that none was found).
- evidence: the titles of the excerpts you relied on (empty array if none).
- Return one item per requirement, in the same order.`;

interface RetrievedReq {
  requirement: string;
  evidence: Array<{ title: string; content: string }>;
}

export async function checkCompliance(
  orgId: string,
  requirements: string[]
): Promise<ComplianceItem[]> {
  if (!orgId) throw new Error("checkCompliance: orgId required");
  const reqs = requirements.map((r) => r.trim()).filter(Boolean);
  if (reqs.length === 0) return [];

  // 1. Retrieve tenant-bound evidence for every requirement (concurrently, capped).
  const retrieved: RetrievedReq[] = [];
  for (const requirement of reqs) {
    let evidence: RetrievedReq["evidence"] = [];
    try {
      const qEmbedding = await embedQuery(requirement);
      const hits = await tenantChunkSearch(orgId, qEmbedding, {
        limit: EVIDENCE_PER_REQ,
        minSimilarity: 0.25,
      });
      evidence = hits.map((h) => ({ title: h.title, content: h.content }));
    } catch (err) {
      console.error("[compliance] retrieval failed for a requirement:", err);
    }
    retrieved.push({ requirement, evidence });
  }

  // 2. Classify in batches (deterministic, schema-forced).
  const out: ComplianceItem[] = [];
  for (let i = 0; i < retrieved.length; i += REQS_PER_BATCH) {
    const batch = retrieved.slice(i, i + REQS_PER_BATCH);
    out.push(...(await classifyBatch(batch)));
  }
  return out;
}

async function classifyBatch(batch: RetrievedReq[]): Promise<ComplianceItem[]> {
  const prompt = batch
    .map((r, idx) => {
      const ev =
        r.evidence.length === 0
          ? "(no internal evidence found)"
          : r.evidence
              .map((e, j) => `  Evidence ${j + 1} — ${e.title}:\n  ${e.content.slice(0, 800)}`)
              .join("\n");
      return `Requirement ${idx + 1}: ${r.requirement}\nEvidence:\n${ev}`;
    })
    .join("\n\n---\n\n");

  try {
    const { object } = await generateObject({
      model: getChatModel(),
      schema: ComplianceMatrixSchema,
      schemaName: "compliance_matrix",
      temperature: 0,
      maxRetries: 2,
      system: SYSTEM,
      prompt,
    });

    // Defensive: align length to the batch even if the model under/over-returns.
    return batch.map((r, idx) => {
      const item = object.items[idx];
      if (item) return { ...item, requirement: r.requirement };
      return {
        requirement: r.requirement,
        status: "UNKNOWN" as const,
        risk: "MEDIUM" as const,
        rationale: "The compliance model did not return a verdict for this requirement.",
        evidence: r.evidence.map((e) => e.title),
      };
    });
  } catch (err) {
    console.error("[compliance] classification failed:", err);
    // Never silently drop requirements — emit explicit UNKNOWN rows.
    return batch.map((r) => ({
      requirement: r.requirement,
      status: "UNKNOWN" as const,
      risk: "MEDIUM" as const,
      rationale: "Compliance analysis was unavailable for this requirement.",
      evidence: r.evidence.map((e) => e.title),
    }));
  }
}
