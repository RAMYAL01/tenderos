import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// ── Anthropic (Claude) client ─────────────────────────────────────────────────
// Primary model for all proposal-related generation.
// Claude 3.5 Sonnet: best quality for Arabic/English procurement documents.
// Claude 3.5 Haiku: fast + cheap for bulk extractions.

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is not set");
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── OpenAI client ─────────────────────────────────────────────────────────────
// Used for: text-embedding-3-large (1536-dim embeddings for content library)
// Also used as a fallback LLM if Claude is unavailable.

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ── Model constants ───────────────────────────────────────────────────────────

export const MODELS = {
  // High-quality generation: proposal sections, executive summaries
  CLAUDE_SONNET: "claude-3-5-sonnet-20241022",
  // Fast, cost-efficient: requirement extraction, compliance matrix
  CLAUDE_HAIKU: "claude-3-5-haiku-20241022",
  // Embeddings: content library search
  EMBEDDING: "text-embedding-3-large",
  EMBEDDING_DIMS: 1536,
  // Fallback generation
  GPT_4O: "gpt-4o",
  GPT_4O_MINI: "gpt-4o-mini",
} as const;

// ── Token cost tracking ───────────────────────────────────────────────────────

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const costs: Record<string, { input: number; output: number }> = {
    [MODELS.CLAUDE_SONNET]: { input: 0.000003, output: 0.000015 },
    [MODELS.CLAUDE_HAIKU]:  { input: 0.000001, output: 0.000005 },
    [MODELS.GPT_4O]:        { input: 0.0000025, output: 0.00001 },
    [MODELS.GPT_4O_MINI]:   { input: 0.00000015, output: 0.0000006 },
  };
  const c = costs[model];
  if (!c) return 0;
  return c.input * promptTokens + c.output * completionTokens;
}

// ── Retry helper ──────────────────────────────────────────────────────────────

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRateLimit =
        lastError.message.includes("rate_limit") ||
        lastError.message.includes("529") ||
        lastError.message.includes("overloaded");
      if (!isRateLimit || attempt === maxAttempts) throw lastError;
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw lastError;
}
