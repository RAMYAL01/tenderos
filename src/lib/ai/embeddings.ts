/**
 * Embedding utilities for semantic search in the content library.
 *
 * Uses OpenAI text-embedding-3-large (1536 dimensions).
 * Embeddings are stored as JSON arrays in the content_library_items table.
 * Similarity is computed in-process using cosine similarity.
 *
 * For large libraries (>5,000 items), replace with pgvector or Pinecone.
 */

import { db } from "@/lib/prisma";
import type { SectionType } from "@prisma/client";
import { embedQuery } from "@/lib/ai/embedding-provider";
import { tenantChunkSearch } from "@/lib/security/rag-search";

/**
 * Generate an embedding vector for a text string, via the configured provider
 * (OpenAI by default, Ollama when EMBEDDING_PROVIDER=ollama).
 */
export async function embedText(text: string): Promise<number[]> {
  return embedQuery(text);
}

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between 0 (orthogonal) and 1 (identical).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

/**
 * Get relevant content library items for a given query.
 * Uses cosine similarity on stored embeddings.
 *
 * @returns Array of content strings (titleEn + contentEn) for the top matches
 */
export async function getContentLibraryContext(
  orgId: string,
  query: string,
  _sectionType?: SectionType,
  limit = 3
): Promise<string[]> {
  if (!orgId || !query?.trim()) return [];

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(query);
  } catch {
    return [];
  }

  // Tenant-bound pgvector search (pre-filtered by orgId in SQL).
  const hits = await tenantChunkSearch(orgId, queryEmbedding, {
    limit: Math.max(1, Math.min(10, limit * 2)),
    minSimilarity: 0.3,
  });

  // Collapse to the top `limit` distinct source documents, preserving the
  // best-ranked chunk's text for each.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of hits) {
    if (seen.has(h.sourceId)) continue;
    seen.add(h.sourceId);
    out.push(`TITLE: ${h.title}\n\n${h.content}`);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Update the embedding for a content library item.
 * Called when a new item is added or content is updated.
 */
export async function updateLibraryItemEmbedding(
  itemId: string
): Promise<void> {
  const item = await db.contentLibraryItem.findUnique({
    where: { id: itemId },
    select: { titleEn: true, contentEn: true, titleAr: true, contentAr: true },
  });

  if (!item) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: { embeddingEn?: any; embeddingAr?: any } = {};

  if (item.titleEn || item.contentEn) {
    const text = `${item.titleEn ?? ""}\n\n${item.contentEn ?? ""}`.trim();
    if (text) {
      updates.embeddingEn = await embedText(text);
    }
  }

  if (item.titleAr || item.contentAr) {
    const text = `${item.titleAr ?? ""}\n\n${item.contentAr ?? ""}`.trim();
    if (text) {
      updates.embeddingAr = await embedText(text);
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.contentLibraryItem.update({
      where: { id: itemId },
      data: updates,
    });
  }
}
