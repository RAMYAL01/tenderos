-- pgvector setup for tenant-isolated Corporate Memory (KnowledgeChunk).
-- Prisma `db push` creates the table + the embedding vector(1536) column and the
-- "orgId" btree index, but it cannot create an index on an Unsupported() type —
-- so the ANN index is applied here. Safe to re-run (IF NOT EXISTS).

CREATE EXTENSION IF NOT EXISTS vector;

-- HNSW + cosine ops: matches the `<=>` operator used by tenantChunkSearch.
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

-- Composite index helps the tenant pre-filter feed the ANN scan efficiently.
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_org ON knowledge_chunks ("orgId");
