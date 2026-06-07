-- Runs once on first DB init (mounted into the pgvector container).
-- pgvector backs the tenant-isolated RAG corpus; pgcrypto provides
-- gen_random_uuid() used by the ingestion raw-SQL inserts.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
