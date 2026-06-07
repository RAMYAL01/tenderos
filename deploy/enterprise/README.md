# TenderOS Enterprise — air-gapped reference stack

Fully on-prem deployment. Nothing here makes an external AI call — the app
reaches only in-network services (vLLM, Ollama, Postgres+pgvector, Keycloak,
MinIO). Full design: [`docs/phase4-enterprise-self-hosted.md`](../../docs/phase4-enterprise-self-hosted.md).

## Bring-up (connected staging, to build the offline bundle)

```bash
cp .env.enterprise.example .env      # fill secrets (Vault-managed in prod)

# Pre-stage model weights into the volumes (one-time, on a connected box):
#   Qwen2.5-14B-Instruct  -> models volume   (chat, served as "tenderos")
#   bge-m3 (1536-dim)      -> ollama volume   (embeddings)
docker compose run --rm ollama ollama pull bge-m3

docker compose up -d db
# apply schema with the app's Prisma:
#   DATABASE_URL=postgres://... npx prisma db push
#   then deploy/enterprise/initdb runs CREATE EXTENSION vector/pgcrypto
docker compose up -d
```

## Air-gapped install
1. On a connected box: pull all images + model weights, `docker save` images to
   a private registry tarball, snapshot the `models`/`ollama` volumes.
2. Transfer the signed bundle via approved media into the isolated zone.
3. `docker load` / push to the internal registry; restore volumes; `compose up`.
4. Verify egress is DENY-ALL and run the readiness checklist (design doc §8).

## The app's local-AI switches (already in code)
| Var | Value |
|---|---|
| `LLM_PROVIDER` | `local` → vLLM via `LLM_BASE_URL` |
| `EMBEDDING_PROVIDER` | `ollama` → `OLLAMA_HOST`, 1536-dim model |

No code change between cloud and on-prem — only env.
