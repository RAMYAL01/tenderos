/**
 * Tenant-isolated ingestion pipeline (Corporate Memory).
 *
 *   document → chunk → embed (batched) → persist source + chunks atomically
 *
 * Every chunk row carries the caller's `orgId`. The vector column is an
 * Unsupported("vector(1536)") so it is written via raw SQL inside the same
 * transaction as the source document — either the whole document lands or none
 * of it does. Embeddings are computed BEFORE the transaction opens so a slow
 * model never holds a DB transaction (and its connection) open.
 *
 * SECURITY: `orgId` is always a bound parameter; the vector is a validated
 * literal cast `::vector`. There is no string interpolation of untrusted input.
 */

import { db } from "@/lib/prisma";
import { chunkText } from "./chunk";
import {
  getEmbeddingProvider,
  toVectorLiteral,
  EMBEDDING_DIMS,
} from "@/lib/ai/embedding-provider";

export interface IngestInput {
  orgId: string;
  memberId: string;
  title: string;
  content: string;
  tags: string[];
}

export interface IngestResult {
  sourceId: string;
  chunks: number;
  model: string;
}

export async function ingestKnowledgeDocument(input: IngestInput): Promise<IngestResult> {
  const { orgId, memberId, title, content, tags } = input;
  if (!orgId) throw new Error("ingest: orgId is required");
  if (!memberId) throw new Error("ingest: memberId is required");

  const provider = getEmbeddingProvider();
  if (provider.dims !== EMBEDDING_DIMS) {
    // Hard stop: a model mismatch would corrupt the vector(1536) column.
    throw new Error(
      `ingest: provider "${provider.id}" emits ${provider.dims} dims but the column is ${EMBEDDING_DIMS}. Re-index before switching models.`
    );
  }

  // 1. Chunk. The title is carried into the text so it influences recall.
  const chunks = chunkText(`${title}\n\n${content}`);
  if (chunks.length === 0) throw new Error("ingest: no chunkable content");

  // 2. Embed every chunk up-front (batched inside the provider).
  const vectors = await provider.embed(chunks.map((c) => c.content));
  if (vectors.length !== chunks.length) {
    throw new Error(`ingest: embedding count ${vectors.length} != chunk count ${chunks.length}`);
  }
  // Pre-build validated vector literals (throws on bad dims / non-finite).
  const literals = vectors.map(toVectorLiteral);

  // 3. Persist atomically. Source via the typed client; chunk vectors via raw SQL.
  const result = await db.$transaction(
    async (tx) => {
      const source = await tx.contentLibraryItem.create({
        data: {
          orgId,
          titleEn: title,
          contentEn: content,
          tags,
          contentSource: "IMPORTED",
          createdById: memberId,
        },
        select: { id: true },
      });

      for (let i = 0; i < chunks.length; i++) {
        await tx.$executeRaw`
          INSERT INTO knowledge_chunks
            (id, "orgId", "sourceId", "chunkIndex", content, "tokenCount", embedding, model, "createdAt")
          VALUES
            (gen_random_uuid()::text, ${orgId}, ${source.id}, ${chunks[i].index},
             ${chunks[i].content}, ${chunks[i].tokenCount}, ${literals[i]}::vector, ${provider.id}, now())
        `;
      }

      return { sourceId: source.id, chunks: chunks.length, model: provider.id };
    },
    { timeout: 30_000 }
  );

  return result;
}

/**
 * Re-embed an existing document's chunks (e.g. after an embedding-model swap).
 * Deletes and rewrites this source's chunks only — strictly within its tenant.
 */
export async function reindexSource(orgId: string, sourceId: string): Promise<IngestResult> {
  if (!orgId || !sourceId) throw new Error("reindex: orgId and sourceId required");

  const source = await db.contentLibraryItem.findFirst({
    where: { id: sourceId, orgId, deletedAt: null },
    select: { id: true, titleEn: true, contentEn: true, createdById: true, tags: true },
  });
  if (!source) throw new Error("reindex: source not found for this tenant");

  const provider = getEmbeddingProvider();
  const chunks = chunkText(`${source.titleEn}\n\n${source.contentEn ?? ""}`);
  const vectors = await provider.embed(chunks.map((c) => c.content));
  const literals = vectors.map(toVectorLiteral);

  await db.$transaction(
    async (tx) => {
      // Tenant-scoped delete — never touches another org's rows.
      await tx.$executeRaw`DELETE FROM knowledge_chunks WHERE "orgId" = ${orgId} AND "sourceId" = ${sourceId}`;
      for (let i = 0; i < chunks.length; i++) {
        await tx.$executeRaw`
          INSERT INTO knowledge_chunks
            (id, "orgId", "sourceId", "chunkIndex", content, "tokenCount", embedding, model, "createdAt")
          VALUES
            (gen_random_uuid()::text, ${orgId}, ${sourceId}, ${chunks[i].index},
             ${chunks[i].content}, ${chunks[i].tokenCount}, ${literals[i]}::vector, ${provider.id}, now())
        `;
      }
    },
    { timeout: 30_000 }
  );

  return { sourceId, chunks: chunks.length, model: provider.id };
}
