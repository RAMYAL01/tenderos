/**
 * Embedding utilities for semantic search in the content library.
 *
 * Uses OpenAI text-embedding-3-large (1536 dimensions).
 * Embeddings are stored as JSON arrays in the content_library_items table.
 * Similarity is computed in-process using cosine similarity.
 *
 * For large libraries (>5,000 items), replace with pgvector or Pinecone.
 */

import { openai, MODELS } from "@/lib/ai/client";
import { db } from "@/lib/prisma";
import type { SectionType } from "@prisma/client";

/**
 * Generate an embedding vector for a text string.
 */
export async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: MODELS.EMBEDDING,
    input: text.slice(0, 8000), // Truncate to stay within token limit
    dimensions: MODELS.EMBEDDING_DIMS,
  });
  return response.data[0].embedding;
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
  sectionType?: SectionType,
  limit = 3
): Promise<string[]> {
  // Get library items with embeddings
  const items = await db.contentLibraryItem.findMany({
    where: {
      orgId,
      deletedAt: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      embeddingEn: { not: null as any },
      ...(sectionType ? { sectionType } : {}),
    },
    select: {
      id: true,
      titleEn: true,
      contentEn: true,
      embeddingEn: true,
    },
    take: 200, // Limit to avoid loading huge datasets into memory
  });

  if (items.length === 0) return [];

  // Generate query embedding
  const queryEmbedding = await embedText(query);

  // Score each item
  const scored = items
    .filter((item) => item.embeddingEn && item.contentEn)
    .map((item) => {
      const embedding = item.embeddingEn as number[];
      const score = cosineSimilarity(queryEmbedding, embedding);
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .filter((s) => s.score > 0.5); // Only include reasonably similar items

  return scored.map(({ item }) =>
    `TITLE: ${item.titleEn}\n\n${item.contentEn}`
  );
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
