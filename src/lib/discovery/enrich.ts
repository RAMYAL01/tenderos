import { z } from "zod";
import { getAnthropic, MODELS } from "@/lib/ai/client";
import { isLocalLLM } from "@/lib/ai/llm-provider";

/**
 * AI enrichment (Phase 4) — turns a raw tender notice into procurement
 * intelligence: a plain-English summary, bid risk notes, likely required
 * certifications, and eligibility indicators.
 *
 * Runs on the GLOBAL catalog (public tender text ONLY — no tenant data ever), so
 * each opportunity is enriched ONCE and the result is shared across every
 * workspace. Uses the cheap/fast Haiku model via the raw Anthropic SDK with
 * NATIVE TOOL-USE for reliable structured output (the AI-SDK generateObject path
 * 404s against this provider version). Grounded: the prompt forbids inventing
 * specifics not present in the notice.
 */

export interface RawOpp {
  titleEn: string;
  descriptionEn: string | null;
  buyerName: string | null;
  country: string | null;
  sector: string | null;
  tenderType: string | null;
}

const SECTORS = [
  "construction",
  "facilities",
  "oil_gas",
  "infrastructure",
  "consulting",
  "supply",
  "services",
  "it",
  "other",
] as const;

const EnrichmentSchema = z.object({
  summary: z.string().max(500),
  riskNotes: z
    .array(z.object({ note: z.string().max(240), severity: z.enum(["low", "medium", "high"]) }))
    .max(5),
  requiredCertifications: z.array(z.string().max(100)).max(8),
  eligibilityNotes: z.string().max(400),
  sector: z.enum(SECTORS),
});

export interface OppEnrichment {
  summary: string;
  riskNotes: { note: string; severity: "low" | "medium" | "high" }[];
  requiredCertifications: string[];
  eligibilityNotes: string | null;
  sector: string | null;
  model: string;
}

// Anthropic tool schema (JSON Schema) — forces structured output.
const TOOL = {
  name: "record_tender_intelligence",
  description: "Record the structured procurement intelligence for this tender notice.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: { type: "string", description: "1-2 sentence plain-English summary: what is procured, for whom." },
      riskNotes: {
        type: "array",
        description: "Bid risks a contractor should weigh (tight deadline, broad/unclear scope, heavy local-content rules, specialised certs, large value). Empty if none evident.",
        items: {
          type: "object",
          properties: {
            note: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: ["note", "severity"],
        },
      },
      requiredCertifications: {
        type: "array",
        description: "Certifications / registrations / contractor classifications likely required (e.g. ISO 9001, local contractor grade, prequalification). Empty if none stated.",
        items: { type: "string" },
      },
      eligibilityNotes: {
        type: "string",
        description: "Who is eligible / key prerequisites (experience, JV rules, local presence). Empty string if not indicated.",
      },
      sector: { type: "string", enum: SECTORS, description: "Best-fit sector for a MENA contractor." },
    },
    required: ["summary", "riskNotes", "requiredCertifications", "eligibilityNotes", "sector"],
  },
};

export async function enrichOpportunity(opp: RawOpp): Promise<OppEnrichment | null> {
  // Air-gapped edition uses the local-model seam, not the raw cloud SDK — skip
  // enrichment there for now (it's an enhancement, not load-bearing).
  if (isLocalLLM()) return null;

  const prompt = `You are a procurement analyst for MENA government & infrastructure contractors (EPC, construction, facilities management, engineering). Enrich this public tender notice for a contractor deciding whether to bid.

Use ONLY the facts in the notice. Do NOT invent values, deadlines, or requirements that aren't stated — leave fields empty when the notice doesn't say. Call record_tender_intelligence with your analysis.

Title: ${opp.titleEn}
Buyer: ${opp.buyerName ?? "—"}
Country: ${opp.country ?? "—"}
Tender type: ${opp.tenderType ?? "—"}
Current sector guess: ${opp.sector ?? "—"}
Description: ${(opp.descriptionEn ?? "").slice(0, 2000) || "—"}`;

  try {
    const res = await getAnthropic().messages.create({
      model: MODELS.CLAUDE_HAIKU,
      max_tokens: 1024,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: prompt }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return null;

    const parsed = EnrichmentSchema.safeParse(block.input);
    if (!parsed.success) return null;

    return {
      summary: parsed.data.summary,
      riskNotes: parsed.data.riskNotes,
      requiredCertifications: parsed.data.requiredCertifications,
      eligibilityNotes: parsed.data.eligibilityNotes.trim() || null,
      sector: parsed.data.sector,
      model: MODELS.CLAUDE_HAIKU,
    };
  } catch (err) {
    console.error("[enrich] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
