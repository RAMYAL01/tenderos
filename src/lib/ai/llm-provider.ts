/**
 * Pluggable chat-LLM provider — the seam that lets TenderOS run with NO external
 * AI provider (Enterprise / air-gapped edition).
 *
 *   LLM_PROVIDER = "cloud" (default) -> Anthropic Claude
 *                = "local"            -> any OpenAI-compatible endpoint (vLLM /
 *                                        Ollama / TGI) inside the customer's VPC
 *
 * Returns a Vercel AI SDK LanguageModel usable with generateObject/generateText,
 * so agents are written once and the deployment decides where inference runs.
 * Mirrors the Phase-1 embedding-provider seam: in a fully-local install you set
 * EMBEDDING_PROVIDER=ollama + LLM_PROVIDER=local and nothing leaves the network.
 */

import type { LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { MODELS } from "@/lib/ai/client";

export function isLocalLLM(): boolean {
  return process.env.LLM_PROVIDER === "local";
}

let _local: ReturnType<typeof createOpenAICompatible> | null = null;

function localProvider() {
  if (_local) return _local;
  _local = createOpenAICompatible({
    name: "tenderos-local",
    baseURL: process.env.LLM_BASE_URL ?? "http://127.0.0.1:8000/v1",
    apiKey: process.env.LLM_API_KEY ?? "not-needed", // vLLM ignores; keep for TGI/gateways
  });
  return _local;
}

/**
 * The chat model for agentic tasks (extraction, compliance, risk, summary).
 * `modelOverride` lets a caller pin a specific model (e.g. a smaller/faster one
 * for extraction); otherwise LLM_MODEL or the configured default is used.
 */
export function getChatModel(modelOverride?: string): LanguageModel {
  if (isLocalLLM()) {
    const id = modelOverride ?? process.env.LLM_MODEL ?? "tenderos";
    return localProvider()(id);
  }
  return anthropic(modelOverride ?? process.env.LLM_MODEL ?? MODELS.CLAUDE_SONNET);
}

/** Human-readable id of the active model (for AIFeedback.modelVersion provenance). */
export function activeModelId(): string {
  return isLocalLLM()
    ? `local:${process.env.LLM_MODEL ?? "tenderos"}`
    : process.env.LLM_MODEL ?? MODELS.CLAUDE_SONNET;
}
