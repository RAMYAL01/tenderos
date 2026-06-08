# TenderOS Enterprise — Deployment Runbook

End-to-end operational guide to stand up the **air-gapped / on-prem** edition.
It ties together the architecture (`docs/phase4-enterprise-self-hosted.md`), the
Compose stack, the Dockerfile, and the Helm chart (`deploy/enterprise/`).

**Invariant to hold throughout:** when fully configured (`LLM_PROVIDER=local` +
`EMBEDDING_PROVIDER=ollama` + `OCR_PROVIDER=local-vision` + `AUTH_PROVIDER=oidc`)
**no code path reaches an external AI provider.** Pricing is deterministic
BigInt math — never an LLM.

---

## 0. Choose topology + size

| | Use | Tier (see doc §1) |
|---|---|---|
| **Docker Compose** | single GPU node, pilots, smaller sites | Small (≤50 users, 1× A100-40G) |
| **Helm / Kubernetes** | HA, scale, gov data centres | Medium/Large (2–8× A100/H100) |

Models to standardize: **Qwen2.5-14B-Instruct** (chat), **Qwen2.5-VL-7B-Instruct**
(OCR), **bge-m3** (embeddings, 1536-d — must match the pgvector column).

---

## 1. Pre-flight checklist

- [ ] GPU node(s) with NVIDIA driver + `nvidia-container-toolkit` (Compose) or the
      NVIDIA device plugin (k8s). Verify: `nvidia-smi`.
- [ ] ≥ 32 vCPU / 256 GB RAM / 2 TB NVMe per node; **RWX** storage for the shared
      model volume on k8s.
- [ ] Internal container registry reachable from the cluster (no public pulls).
- [ ] Internal CA + TLS cert for the app host (and the Keycloak host).
- [ ] Secrets generated (store in Vault / sealed): `openssl rand -hex 32` for
      `OIDC_SESSION_SECRET`, `INTERNAL_API_KEY`, `CRON_SECRET`, `TRAINING_HMAC_KEY`;
      strong `PG_PASSWORD`, `MINIO_PASSWORD`, `KC_ADMIN_PASSWORD`.
- [ ] IdP decision: Keycloak standalone, or Keycloak federating **Azure AD / ADFS**.
- [ ] **Egress firewall = DENY-ALL** policy prepared for the namespace/VLAN.

---

## 2. Build & stage the offline bundle (on a connected box)

1. **App image** (includes poppler for OCR rasterization):
   ```bash
   docker build -f deploy/enterprise/Dockerfile -t registry.internal/tenderos:enterprise .
   docker push registry.internal/tenderos:enterprise
   ```
2. **Mirror dependency images** into the internal registry:
   `pgvector/pgvector:pg16`, `vllm/vllm-openai:latest`, `ollama/ollama:latest`,
   `quay.io/keycloak/keycloak:26.0`, `minio/minio:latest`, `caddy:2`.
3. **Stage model weights** into the `models` volume/PVC:
   `Qwen2.5-14B-Instruct`, `Qwen2.5-VL-7B-Instruct`.
4. **Transfer** the signed bundle (images tar + weights) via approved media into
   the isolated zone; `docker load` / push to the internal registry; restore the
   volume snapshots.

---

## 3a. Deploy — Docker Compose

```bash
cd deploy/enterprise
cp .env.enterprise.example .env      # fill ALL secrets + APP_URL + OIDC_ISSUER
docker compose up -d db              # start Postgres first (runs initdb -> CREATE EXTENSION vector)
docker compose run --rm ollama ollama pull bge-m3
docker compose up -d                 # app, vllm, vllm-vl, keycloak, minio, caddy
docker compose ps                    # all healthy?
```

## 3b. Deploy — Helm

```bash
helm upgrade --install tos deploy/enterprise/helm/tenderos -n tenderos --create-namespace \
  --set global.appUrl=https://tenderos.gov.local \
  --set global.gpuNodeSelector."node\.kubernetes\.io/gpu"=true \
  --set keycloak.issuerUrl=https://sso.gov.local/realms/tenderos \
  --set secrets.data.PG_PASSWORD=$(openssl rand -hex 24) \
  --set secrets.data.OIDC_SESSION_SECRET=$(openssl rand -hex 32) \
  --set secrets.data.MINIO_PASSWORD=$(openssl rand -hex 24) \
  --set secrets.data.KC_ADMIN_PASSWORD=$(openssl rand -hex 24) \
  --set secrets.data.OIDC_CLIENT_SECRET=... \
  --set secrets.data.INTERNAL_API_KEY=$(openssl rand -hex 32) \
  --set secrets.data.CRON_SECRET=$(openssl rand -hex 32) \
  --set secrets.data.TRAINING_HMAC_KEY=$(openssl rand -hex 32)
kubectl -n tenderos get pods            # wait for vllm/vllm-vl Ready (~2-3 min, model load)
# Pull the embedding model into Ollama:
kubectl -n tenderos exec deploy/tos-ollama -- ollama pull bge-m3
```
> PROD: set `secrets.create=false` and provide an externally-managed Secret
> named `tenderos-secrets` (Vault / External Secrets Operator).

---

## 4. Post-deploy configuration

1. **Database schema** — the app image runs `prisma migrate deploy` (falls back to
   `db push`) on start. Then apply the pgvector ANN index ONCE:
   ```bash
   psql "$DATABASE_URL" -f prisma/sql/knowledge_chunks_index.sql
   ```
2. **Keycloak realm** — create realm `tenderos`; create a confidential OIDC client
   `tenderos` with redirect URI `https://<APP_URL>/api/auth/oidc/callback`; copy the
   client secret into `OIDC_CLIENT_SECRET`. Map IdP groups → roles named
   `owner / admin / manager / senior_writer / writer / reviewer / viewer`
   (the adapter suffix-matches these to `MemberRole`). Set `OIDC_ISSUER` to a
   **browser-reachable** URL. Federate **Azure AD / ADFS** as an identity provider
   if required.
3. **Object storage** — create the `tenderos` bucket in MinIO (console `:9001`).

---

## 5. Verification & acceptance

- [ ] **Zero-egress proof:** from the app pod, outbound to the internet is blocked.
      ```bash
      kubectl -n tenderos exec deploy/tos-app -- sh -c \
        'wget -T3 -q -O- https://api.anthropic.com >/dev/null 2>&1 && echo LEAK || echo BLOCKED'
      ```
      Expect `BLOCKED`. (Repeat for `api.openai.com`.)
- [ ] **SSO login:** visiting the app redirects to Keycloak; after IdP login you
      land on `/dashboard`; the sidebar shows the org name + a logout link.
- [ ] **Health:** `GET /api/health` 200; `vllm`/`vllm-vl`/`ollama` `/health` OK.
- [ ] **RAG works + is isolated:** add a Knowledge doc, Ask a question, get a
      grounded answer with sources. Confirm a cross-tenant query returns 0 rows
      (the orgId pre-rank filter — doc §3 / §4).
- [ ] **Full tender E2E:** upload a scanned bilingual RFP → it OCRs locally
      (`vlm-ocr`), extracts requirements, builds the compliance matrix; price a BOQ
      and confirm the deterministic totals.
- [ ] **Deterministic math fenced:** in CI / a build host, `npm run test:boq`
      passes (BigInt-exact; float-trap `1.005 → 101`).
- [ ] **Model quality gate (optional):** run TenderEval against the local endpoint
      and confirm KPIs clear thresholds:
      ```bash
      python -m eval.run_eval --endpoint http://tos-vllm:8000/v1 --model tenderos \
        --gold eval/datasets/tendereval.test.jsonl
      ```

---

## 6. Day-2 operations

- **Backup / PITR:** nightly `pg_basebackup` + continuous WAL archiving (RPO ≤ 15
  min); MinIO versioning + offsite encrypted snapshot; checksum model weights in
  the artifact store. Test restores quarterly.
- **Monitoring:** scrape GPU util + vLLM queue/latency + Postgres + app
  (Prometheus/Grafana); ship logs + the immutable `AuditLog` to the SIEM.
- **DR:** documented RTO ≤ 1 h; standby Postgres replica; quarterly game-day.
- **Model swap / upgrade:** stage new weights → update `vllm.modelPath` /
  `LLM_MODEL` → rolling restart. After an **embedding-model** change, re-embed
  (`reindexSource` per org) — never mix dimensions.
- **Training flywheel (optional):** experts' 👍/👎/edits accumulate in
  `AIFeedback`; export de-identified JSONL from **Settings → Training Data** or
  `/api/internal/training-export`, then run `training/` (SFT → DPO → TenderEval
  gate → merge) to produce an improved local model.

---

## 7. Migrating an existing cloud customer

Follow doc §6: `pg_dump` Neon → on-prem Postgres; **re-embed** vectors with local
bge-m3 (dimension parity); flip the provider seams to local; `mc mirror` S3 →
MinIO; create the Keycloak realm + federate the IdP + migrate members by email;
parallel-run + checksum cutover; then DNS flip and freeze the cloud tenant.

---

## 8. Go-live sign-off

Complete the **Production Readiness Checklist** in
`docs/phase4-enterprise-self-hosted.md §8` (Security · Monitoring · Backup · DR ·
AI Validation · Compliance) and obtain the security authority sign-off
(NCA ECC / NESA / ISO 27001 control mapping).

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| vLLM pod not Ready | model still loading (raise `failureThreshold`/`start_period`); weights missing from the `models` volume; insufficient VRAM (`gpuMemoryUtilization`). |
| OCR fails ("rasterization") | `poppler-utils` missing in the app image — use the bundled Dockerfile. |
| Login loops / `state mismatch` | `OIDC_ISSUER` not browser-reachable; redirect URI mismatch; clock skew between app and IdP. |
| RAG returns nothing | embeddings not 1536-d (model mismatch) or HNSW index not applied; re-embed. |
| Pricing looks off | it shouldn't — it's deterministic. Run `npm run test:boq`; check the org's rate catalogue, not the model. |
