/**
 * Pluggable embedding provider.
 *
 * The rest of the RAG pipeline depends on this interface, not on a concrete
 * vendor — so we can swap the cloud model (OpenAI) for a local one (Ollama)
 * for zero-cloud clients without touching ingestion or retrieval.
 *
 * Selection is env-driven:
 *   EMBEDDING_PROVIDER = "openai" (default) | "ollama"
 *
 * INVARIANT: every provider MUST emit exactly EMBEDDING_DIMS-dimensional,
 * finite vectors. The pgvector column is vector(1536); a provider whose model
 * emits a different dimensionality cannot be used without re-indexing (see the
 * local-fallback notes in the RAG docs).
 */

import { openai, MODELS } from "@/lib/ai/client";

export const EMBEDDING_DIMS = 1536;
const MAX_INPUT_CHARS = 8000; // safety clamp per text (well under token limits)
const OPENAI_BATCH = 96; // inputs per OpenAI request

export interface EmbeddingProvider {
  /** Model identifier, persisted with each chunk for provenance. */
  readonly id: string;
  readonly dims: number;
  /** Returns one vector per input, in input order. */
  embed(texts: string[]): Promise<number[][]>;
}

/** Defensive: reject anything that isn't a finite vector of the expected size. */
function assertVectors(vectors: number[][], dims: number, model: string): void {
  for (let i = 0; i < vectors.length; i++) {
    const v = vectors[i];
    if (!Array.isArray(v) || v.length !== dims) {
      throw new Error(`[embeddings:${model}] vector ${i} has ${v?.length ?? "?"} dims, expected ${dims}`);
    }
    for (let j = 0; j < v.length; j++) {
      if (typeof v[j] !== "number" || !Number.isFinite(v[j])) {
        throw new Error(`[embeddings:${model}] vector ${i} has a non-finite component at ${j}`);
      }
    }
  }
}

function prep(texts: string[]): string[] {
  return texts.map((t) => (t ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_INPUT_CHARS));
}

// ── OpenAI (default cloud provider) ───────────────────────────────────────────

class OpenAIEmbeddings implements EmbeddingProvider {
  readonly id = MODELS.EMBEDDING;
  readonly dims = MODELS.EMBEDDING_DIMS;

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const inputs = prep(texts);
    const out: number[][] = [];
    for (let i = 0; i < inputs.length; i += OPENAI_BATCH) {
      const batch = inputs.slice(i, i + OPENAI_BATCH);
      const res = await openai.embeddings.create({
        model: this.id,
        input: batch,
        dimensions: this.dims,
      });
      // OpenAI may not preserve order — sort by index defensively.
      const vectors = [...res.data].sort((a, b) => a.index - b.index).map((d) => d.embedding as number[]);
      out.push(...vectors);
    }
    assertVectors(out, this.dims, this.id);
    return out;
  }
}

// ── Ollama (local / zero-cloud — see Deliverable 4) ───────────────────────────

class OllamaEmbeddings implements EmbeddingProvider {
  readonly id: string;
  readonly dims: number;
  private readonly host: string;

  constructor() {
    this.id = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";
    this.host = (process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
    // Dimensionality MUST match the pgvector column. Configurable so ops can
    // pin a 1536-dim local model (or re-index for a different size).
    this.dims = Number(process.env.OLLAMA_EMBED_DIMS ?? EMBEDDING_DIMS);
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await fetch(`${this.host}/api/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.id, input: prep(texts) }),
    });
    if (!res.ok) {
      throw new Error(`[embeddings:ollama] ${this.id} failed (${res.status}): ${await res.text().catch(() => "")}`);
    }
    const json = (await res.json()) as { embeddings?: number[][] };
    const vectors = json.embeddings ?? [];
    assertVectors(vectors, this.dims, this.id);
    return vectors;
  }
}

// ── Selection ─────────────────────────────────────────────────────────────────

let _provider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (_provider) return _provider;
  _provider =
    process.env.EMBEDDING_PROVIDER === "ollama" ? new OllamaEmbeddings() : new OpenAIEmbeddings();
  return _provider;
}

/** Convenience for single-text embedding (e.g. a search query). */
export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await getEmbeddingProvider().embed([text]);
  return v;
}

/** Build a safe pgvector literal from a validated numeric vector. */
export function toVectorLiteral(vector: number[]): string {
  if (vector.length !== EMBEDDING_DIMS) {
    throw new Error(`toVectorLiteral: expected ${EMBEDDING_DIMS} dims, got ${vector.length}`);
  }
  for (const n of vector) {
    if (typeof n !== "number" || !Number.isFinite(n)) {
      throw new Error("toVectorLiteral: non-finite component");
    }
  }
  return `[${vector.join(",")}]`;
}
