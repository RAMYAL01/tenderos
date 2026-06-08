/**
 * Part 3 — De-noising & Structuring (Claude messages API).
 *
 * Takes the STITCHED, raw OCR text and cleans + structures it:
 *   - repairs scrambled RTL/LTR token merging (the #1 failure of MENA tenders),
 *   - drops page numbers, watermarks, stamps, repeating headers/footers,
 *   - emits a strict JSON array via forced tool-use.
 *
 * For 100+ page documents the cleaned text exceeds a single context window, so
 * we shard on logical boundaries, run shards with bounded concurrency + retry,
 * and merge — de-duplicating clause_ids.
 */

import { generateObject } from "ai";
import { z } from "zod";
import { MODELS, withRetry } from "@/lib/ai/client";
import { getChatModel } from "@/lib/ai/llm-provider";

export interface StructuredClause {
  clause_id: string;
  original_arabic_text: string;
  english_translation_or_equivalent: string;
  is_mandatory_compliance_item: boolean;
}

const ClausesSchema = z.object({
  clauses: z.array(
    z.object({
      clause_id: z.string(),
      original_arabic_text: z.string(),
      english_translation_or_equivalent: z.string(),
      is_mandatory_compliance_item: z.boolean(),
    })
  ),
});

// ── The advanced system prompt ────────────────────────────────────────────────

export const DENOISE_STRUCTURE_SYSTEM_PROMPT = `You are a senior bilingual (Arabic/English) government-procurement analyst and document-repair engine for a tendering platform. You receive RAW OCR output from scanned Middle Eastern RFP/BOQ PDFs. This text is noisy: low-quality scans, watermarks, stamps, page furniture, and — most importantly — SCRAMBLED bidirectional text where Arabic (RTL) and English/numbers (LTR) on the same line have been merged in the wrong visual/logical order by the OCR engine.

Your job is to CLEAN and STRUCTURE this into discrete tender clauses. You are a repairer and classifier — you do not summarize, invent, or omit substantive content.

# REPAIR RULES
1. BIDIRECTIONAL REPAIR: Reconstruct the correct LOGICAL reading order of each clause.
   - Arabic reads right-to-left; embedded Latin words, acronyms, numbers, units, dates, and reference codes read left-to-right and must be restored to their correct position INSIDE the Arabic sentence.
   - Fix reversed/segmented digit groups (e.g. an OCR'd "0 5" or "٥ ٠" that should be "50"; "2 . 1 . 4" -> "2.1.4"). Never change the numeric VALUE — only its ordering/spacing.
   - Re-join words split across line breaks by the scan.
2. DE-NOISE — DELETE and do NOT emit any of:
   - page numbers ("Page 12 of 220", "١٢", "- 12 -"), running headers/footers that repeat across pages, watermarks ("CONFIDENTIAL", "نسخة غير معتمدة", "DRAFT"), stamp/seal text, signature lines, and OCR artifacts (isolated punctuation, gibberish character runs).
   - decorative table borders and column rulers; keep only the cell CONTENT.
3. PRESERVE: every substantive requirement, specification, condition, eligibility rule, BOQ item description, and deadline. When in doubt about whether something is substantive, KEEP it as a clause.

# SEGMENTATION
- Split the document into atomic clauses: one obligation / requirement / specification / BOQ line per clause. Do not merge unrelated requirements into one clause.

# CLASSIFICATION — is_mandatory_compliance_item
- true when the clause imposes a MANDATORY obligation whose breach risks disqualification or non-compliance. Signals (Arabic + English): "shall", "must", "required", "mandatory", "is a precondition", "يجب", "يلتزم", "إلزامي", "شرط", "لا يقل عن", "تحت طائلة الاستبعاد".
- false for informational text, optional/preferred items, background, or scoring-only criteria ("should", "preferred", "يُفضَّل", "يُستحسن").

# OUTPUT
- Call the tool \`emit_clauses\` exactly once with the array. For each clause:
  - clause_id: the source reference/section number if present (e.g. "3.2.1", "البند 5"); otherwise synthesize a stable sequential id "C-001", "C-002", ... in document order.
  - original_arabic_text: the repaired Arabic text. If the clause is English-only, put the English here. If bilingual, put the Arabic.
  - english_translation_or_equivalent: a faithful English translation (or, if the source is English, the cleaned English text).
  - is_mandatory_compliance_item: boolean per the rules above.
- Output ONLY the tool call. No prose, no markdown, no commentary. If the input contains no substantive clauses, return an empty array.`;

export interface StructureOptions {
  model?: string;
  /** Max characters of OCR text per LLM shard. */
  shardCharBudget?: number;
  concurrency?: number;
}

export interface StructureResult {
  clauses: StructuredClause[];
  shards: number;
  failedShards: number;
}

/**
 * Run Part 3. `documentText` is the stitched, logically-ordered text (page text
 * + serialized stitched tables). Returns merged, de-duplicated clauses.
 */
export async function structureClauses(
  documentText: string,
  opts: StructureOptions = {}
): Promise<StructureResult> {
  const shards = shardText(documentText, opts.shardCharBudget ?? 45_000);
  const concurrency = opts.concurrency ?? 2;

  const collected: StructuredClause[] = [];
  let failedShards = 0;

  const queue = shards.map((text, i) => ({ text, i }));
  const runners = Array.from({ length: Math.min(concurrency, queue.length || 1) }, async () => {
    while (queue.length) {
      const job = queue.shift();
      if (!job) break;
      try {
        const clauses = await withRetry(() => structureOneShard(job.text, opts.model));
        collected.push(...clauses);
      } catch {
        failedShards++; // shard failure is isolated; caller flags LLM_STRUCTURING_FAILED
      }
    }
  });
  await Promise.all(runners);

  return { clauses: dedupeClauses(collected), shards: shards.length, failedShards };
}

async function structureOneShard(text: string, model?: string): Promise<StructuredClause[]> {
  // Sonnet (cloud) or local vLLM — Arabic + compliance reasoning need headroom.
  const { object } = await generateObject({
    model: getChatModel(model ?? MODELS.CLAUDE_SONNET),
    schema: ClausesSchema,
    schemaName: "emit_clauses",
    temperature: 0,
    maxOutputTokens: 8000,
    system: DENOISE_STRUCTURE_SYSTEM_PROMPT,
    prompt: `Clean and structure the following raw OCR text from a tender document.\n\n<ocr_text>\n${text}\n</ocr_text>`,
  });

  return (object.clauses ?? [])
    .filter((c) => c && typeof c.clause_id === "string")
    .map((c) => ({
      clause_id: String(c.clause_id).trim(),
      original_arabic_text: String(c.original_arabic_text ?? "").trim(),
      english_translation_or_equivalent: String(c.english_translation_or_equivalent ?? "").trim(),
      is_mandatory_compliance_item: Boolean(c.is_mandatory_compliance_item),
    }));
}

/** Shard on paragraph boundaries so a clause is never split mid-sentence. */
function shardText(text: string, budget: number): string[] {
  if (text.length <= budget) return [text];
  const blocks = text.split(/\n{2,}/);
  const shards: string[] = [];
  let current = "";
  for (const block of blocks) {
    if (current.length + block.length + 2 > budget && current) {
      shards.push(current);
      current = "";
    }
    current += (current ? "\n\n" : "") + block;
  }
  if (current) shards.push(current);
  return shards;
}

/** Merge shard outputs; later duplicates of a clause_id are dropped. */
function dedupeClauses(clauses: StructuredClause[]): StructuredClause[] {
  const seen = new Set<string>();
  const out: StructuredClause[] = [];
  for (const c of clauses) {
    const key = c.clause_id || `${c.original_arabic_text}|${c.english_translation_or_equivalent}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
