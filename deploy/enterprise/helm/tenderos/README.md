# TenderOS Enterprise — Helm chart

Air-gapped Kubernetes install of the full stack: app, private chat LLM (vLLM
Qwen2.5), OCR VLM (vLLM Qwen2.5-VL), embeddings (Ollama bge-m3), Postgres +
pgvector, Keycloak SSO, and MinIO — **zero external AI calls**.

## Install
```bash
# 1) Mirror all images into your internal registry; set them in values.yaml.
# 2) Provide secrets (dev shown; PROD: secrets.create=false + external Secret):
helm upgrade --install tos ./tenderos -n tenderos --create-namespace \
  --set global.appUrl=https://tenderos.gov.local \
  --set global.gpuNodeSelector."node\.kubernetes\.io/gpu"=true \
  --set secrets.data.PG_PASSWORD=$(openssl rand -hex 24) \
  --set secrets.data.OIDC_CLIENT_SECRET=... \
  --set secrets.data.OIDC_SESSION_SECRET=$(openssl rand -hex 32) \
  --set secrets.data.MINIO_PASSWORD=$(openssl rand -hex 24) \
  --set secrets.data.KC_ADMIN_PASSWORD=$(openssl rand -hex 24) \
  --set secrets.data.INTERNAL_API_KEY=$(openssl rand -hex 32) \
  --set secrets.data.CRON_SECRET=$(openssl rand -hex 32) \
  --set secrets.data.TRAINING_HMAC_KEY=$(openssl rand -hex 32)
```

Then follow the post-install NOTES (stage model weights into the `models` PVC,
pull the embedding model into Ollama, configure the Keycloak realm + client +
Azure AD/ADFS federation, apply the HNSW index).

## Requirements
- GPU nodes with the NVIDIA device plugin (`global.gpuResourceKey`, default
  `nvidia.com/gpu`); set `global.gpuNodeSelector`.
- A **RWX** storage class for the shared `models` PVC (both vLLM pods mount it),
  plus RWO for Postgres/Ollama/MinIO. Set `global.storageClass`.
- An ingress controller (default class `nginx`) and an internal-CA TLS secret
  (`ingress.tls.secretName`).

## Config
Everything is in `values.yaml`: images, GPU counts, model paths/served names,
storage sizes, Keycloak realm + `keycloak.issuerUrl` (browser-reachable),
Postgres (or `postgres.enabled=false` + `externalUrl`), and the secret strategy.

The app's three local-AI switches are pre-wired by the chart:
`LLM_PROVIDER=local`, `EMBEDDING_PROVIDER=ollama`, `OCR_PROVIDER=local-vision`,
and `AUTH_PROVIDER=oidc` → Keycloak.
