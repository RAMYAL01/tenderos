/**
 * Part 2a — Tenant-Bound RAG over pgvector (Neon).
 *
 * Vector similarity search that STRICTLY confines results to one tenant. The
 * `orgId` predicate is a BOUND parameter inside the SQL `WHERE`, applied BEFORE
 * ranking and `LIMIT`, so a nearest-neighbour from another tenant can never be
 * ranked, returned, or leak into the LLM context.
 *
 * Schema requirement (applied to Neon):
 *   CREATE EXTENSION IF NOT EXISTS vector;
 *   ALTER TABLE content_library_items ADD COLUMN embedding vector(1536);
 *   CREATE INDEX CONCURRENTLY idx_cli_embedding
 *     ON content_library_items USING hnsw (embedding vector_cosine_ops);
 * (Prisma maps it as `embedding Unsupported("vector(1536)")?` — queried only via
 * $queryRaw, never the typed client.)
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";

export const EMBEDDING_DIMS = 1536;

export interface RagChunk {
  id: string;
  title: string;
  snippet: string;
  similarity: number; // cosine similarity 0..1
}

export interface RagSearchOptions {
  limit?: number;
  /** Minimum cosine similarity (0..1) to include. */
  minSimilarity?: number;
}

/**
 * Cosine-similarity search confined to `orgId`.
 *
 * SECURITY: callers MUST pass the tenant's own orgId (from the verified
 * session). This function does not — and cannot — return cross-tenant rows.
 */
export async function tenantVectorSearch(
  orgId: string,
  queryEmbedding: number[],
  opts: RagSearchOptions = {}
): Promise<RagChunk[]> {
  if (!orgId) throw new Error("tenantVectorSearch: orgId is required.");
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== EMBEDDING_DIMS) {
    throw new Error(`tenantVectorSearch: embedding must have exactly ${EMBEDDING_DIMS} dims.`);
  }
  if (queryEmbedding.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
    throw new Error("tenantVectorSearch: embedding contains non-finite values.");
  }

  const limit = clampInt(opts.limit ?? 5, 1, 50);
  const minSimilarity = clampNum(opts.minSimilarity ?? 0.5, 0, 1);

  // Build the pgvector literal from validated numbers (no injection surface).
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const rows = await db.$queryRaw<
    Array<{ id: string; title: string; snippet: string; similarity: number }>
  >(Prisma.sql`
    SELECT
      id,
      "titleEn" AS title,
      left(coalesce("contentEn", ''), 1200) AS snippet,
      1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM content_library_items
    WHERE "orgId" = ${orgId}                 -- TENANT ISOLATION (bound param, pre-rank)
      AND "deletedAt" IS NULL
      AND embedding IS NOT NULL
      AND 1 - (embedding <=> ${vectorLiteral}::vector) >= ${minSimilarity}
    ORDER BY embedding <=> ${vectorLiteral}::vector ASC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    snippet: r.snippet,
    similarity: Number(r.similarity),
  }));
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.trunc(n)));
}
function clampNum(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
