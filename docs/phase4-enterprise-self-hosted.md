# TenderOS Enterprise — Self-Hosted / Air-Gapped AI Edition (Phase 4)

Production architecture for deploying TenderOS **entirely inside** an enterprise
or government network. No document, BOQ, price, or tender ever leaves the
customer's infrastructure: no Claude/OpenAI API, no Vercel, no Neon, no egress.

The app was built provider-agnostic for exactly this:
- **LLM seam** — `src/lib/ai/llm-provider.ts` (`LLM_PROVIDER=local` → vLLM).
- **Embedding seam** — `src/lib/ai/embedding-provider.ts` (`EMBEDDING_PROVIDER=ollama`).
- **Deterministic pricing** — pure BigInt TS, never an LLM (unchanged on-prem).
- **Tenant-isolated RAG** — pgvector with the orgId pre-rank filter (unchanged).

A reference stack ships in [`deploy/enterprise/`](../deploy/enterprise).

---

## 1. LLM Infrastructure

### Model recommendation by task

| Task | Recommended | Why |
|---|---|---|
| BOQ extraction (structured, bilingual) | **Qwen2.5-14B-Instruct** | Best Arabic of the open set; strong JSON/tool adherence; fits one 80 GB GPU at full ctx |
| Tender / scope analysis | **Qwen2.5-32B-Instruct** (large tier) | More reasoning headroom for long RFPs |
| Compliance matrix (RAG-grounded) | **Qwen2.5-14B** + our retrieval | Grounded classification; low fabrication with temp 0 |
| Executive summary / proposal prose | **Qwen2.5-14B/32B** | Fluent bilingual generation |
| Embeddings (1536-d) | **BGE-M3** (multilingual) | Strong Arabic+English retrieval; matches the vector(1536) column |
| OCR (scanned PDFs) | **Qwen2.5-VL-7B** (vision) | Replaces the cloud Claude/Azure OCR path on-prem |

### Open-model comparison (for this domain)

| Model | Arabic | Technical reasoning | JSON/tool reliability | License | Verdict |
|---|---|---|---|---|---|
| **Qwen2.5 (7/14/32/72B)** | **Excellent** | High | **Excellent** | Apache-2.0 | **Primary** — best Arabic + permissive |
| DeepSeek-V2.5 / V3 | Good | **Very high** | High | MIT/custom | Strong reasoning; heavier to host; Arabic < Qwen |
| Llama 3.1 (8/70B) | Fair (weak diacritized Arabic) | High | High | Llama license (restrictions) | Good EN; **Arabic gap** is disqualifying here |
| Mistral (Small/Large, Nemo) | Fair | High | High | Apache (Nemo) / custom | Efficient EN; Arabic weaker than Qwen |

**Decision:** **Qwen2.5** family is the standardized base (Apache-2.0, best Arabic,
reliable structured output). It is also our fine-tuning base (Phase 3), so the
on-prem model = the tuned `tenderos` adapter merged onto Qwen2.5.

### Hardware tiers

| Tier | Users | Chat model | GPUs | Throughput | Notes |
|---|---|---|---|---|---|
| **Small** | ≤ 50 | Qwen2.5-14B (AWQ/4-bit) | 1× **A100-40GB** or 2× L40S | ~10–20 concurrent reqs | Single node; vLLM + Ollama share box |
| **Medium** | ≤ 200 | Qwen2.5-14B (fp16) + VL-7B OCR | 2× **A100-80GB** or 2× H100 | ~40–80 concurrent | Separate OCR GPU; HA Postgres |
| **Large** | ≤ 1000 | Qwen2.5-32B (TP=2) + 14B + VL | 4–8× **H100-80GB** | 150+ concurrent | vLLM replicas behind a router; GPU autoscaling |

CPU/RAM/disk per node: ≥ 32 vCPU / 256 GB RAM / 2 TB NVMe (models + pgvector +
documents). Model weights: ~30 GB (14B fp16) / ~60 GB (32B) / ~9 GB (VL-7B).

---

## 2. Local AI Stack

```
                         ┌──────────────────────────── on-prem / air-gapped VPC ───────────────────────────┐
   user (browser, mTLS)  │                                                                                  │
        │                │   ┌─────────┐    ┌──────────────┐    ┌──────────────────────────────────────┐   │
        └───────► 443 ───┼──►│  Caddy  │───►│ TenderOS app │───►│ Deterministic BOQ engine (pure TS)    │   │
                         │   │ (TLS,   │    │ (Next.js,    │    │  — BigInt math, NO model               │   │
                         │   │  HSTS)  │    │  Node)       │    └──────────────────────────────────────┘   │
                         │   └────┬────┘    │              │                                                │
                         │        │ /auth   │   agents ────┼──► vLLM  (OpenAI API)  Qwen2.5  [GPU]          │
                         │   ┌────▼─────┐   │              │       └ chat: extraction, compliance, risk,   │
                         │   │ Keycloak │◄──┤ OIDC/SAML    │         procurement, exec-summary             │
                         │   │  (SSO)   │   │              ├──► Ollama (embeddings) BGE-M3 1536d [GPU]      │
                         │   └────┬─────┘   │              │                                                │
                         │        │ federate│              ├──► Postgres + pgvector  (data + RAG vectors)   │
                         │   (Azure AD /    │              │                                                │
                         │    on-prem ADFS) └──────┬───────┘──► MinIO (S3) documents, exports              │
                         │                         │                                                        │
                         │   Open WebUI ───────────┘ (admin model testing against vLLM, optional)           │
                         └──────────────────────────────────────────────────────────────────────────────── ┘
                                              egress firewall: DENY ALL outbound
```

### Service responsibilities

| Service | Responsibility | Notes |
|---|---|---|
| **Caddy / NGINX** | TLS termination (internal CA), HSTS, security headers, reverse proxy | mTLS optional for gov |
| **TenderOS app** | UI, workflow orchestrator, RBAC, audit, deterministic pricing | self-hosted `next start` |
| **vLLM** | Private chat inference (OpenAI-compatible) for all agents | `--served-model-name tenderos` |
| **Ollama** | Local embeddings (BGE-M3 @ 1536d) for ingestion + RAG queries | matches `vector(1536)` |
| **Qwen2.5-VL (vLLM)** | On-prem OCR for scanned Arabic/English PDFs | replaces cloud OCR |
| **Postgres + pgvector** | Tenant data, audit log, RAG chunks + HNSW index | streaming replica for HA |
| **Keycloak** | SSO (OIDC/SAML), Azure AD/ADFS federation, RBAC mapping | backed by same Postgres |
| **MinIO** | S3-compatible document/export storage | server-side encryption (SSE) |
| **Open WebUI** | Operator sandbox to test the served model | not user-facing |

> vLLM is preferred for throughput/batching; **Ollama** is used for embeddings
> (and is the dev/SMB fallback for chat). The app reaches both purely by the two
> provider seams — no code change between cloud and on-prem.

---

## 3. Multi-Agent Enterprise Architecture

All agents share: **temperature 0**, **forced JSON schema** (zod / vLLM
`guided_json`), **org-scoped RAG**, structured per-call audit, and the rule that
**no agent computes a price or invents a quantity** — pricing is the
deterministic engine; missing data is flagged, never fabricated.

| Agent | Inputs | Outputs | Guardrails | Error handling |
|---|---|---|---|---|
| **Extraction** | raw RFP/BOQ text (+ OCR) | `{line_items[], requirements[]}` (code, desc, unit, qty\|null) | never a price/total; qty null if unprinted; one source row → one item | invalid JSON → 2 retries → `NEEDS_REVIEW`; null qty → engine flags `INVALID_QUANTITY` |
| **Compliance** | requirements + tenant RAG evidence | matrix `{status, risk, rationale, evidence[]}` | use ONLY retrieved evidence; no evidence = `GAP`; cite titles | retrieval fail → row `UNKNOWN`; model fail → batch `UNKNOWN`, never dropped |
| **Risk Analysis** | clauses (LDs, payment, scope, schedule) + evidence | `{risks:[{type, severity, clause_ref, mitigation}]}` | severity from rubric; HIGH for unmet mandatory/LD caps | length-aligned to clauses; missing → flagged, surfaced to reviewer |
| **Procurement** | extracted scope + rate catalogue keys (NOT prices) | sourcing plan `{packages[], long_lead[], vendor_criteria[]}` | references rate **codes**, never amounts; no vendor invented without evidence | unknown item → `needs_sourcing` flag |
| **Executive Summary** | compliance matrix + risks + pricing **totals** (read-only) | bilingual brief `{en, ar, go_no_go, key_risks[]}` | quotes pricing from the deterministic result only; no recomputation | if any upstream incomplete → summary marked `DRAFT` + lists gaps |

Orchestration = the Phase-2 persisted state machine (`DRAFT → EXTRACTED →
COMPLIANCE_CHECKED → PRICED`), extended with `RISK_ASSESSED` and `SUMMARIZED`
states. Each transition commits, so a single-GPU node processes long tenders
across invocations and resumes on failure. **The deterministic financial router
sits between the agents and the output and is never an LLM.**

---

## 4. Enterprise Security

| Control | Implementation |
|---|---|
| **RBAC** | App roles (OWNER→VIEWER) already enforced server-side + at the data layer (tenant-isolation Prisma extension). Mapped from IdP group claims. |
| **SSO** | OIDC/SAML via **Keycloak**; app trades the IdP token for a session. Replaces Clerk on-prem (`AUTH_PROVIDER=oidc`). |
| **Azure AD** | Federate Azure AD/Entra (or on-prem **ADFS**) **into Keycloak** as an identity provider (OIDC or SAML). Group → role mapping. Air-gapped sites use ADFS, no internet. |
| **Audit logs** | Append-only `AuditLog` (who/what/org/when) emitted by the same client-extension that enforces isolation; shipped to the SIEM (syslog/Splunk/QRadar) and WORM storage. |
| **Encryption at rest** | LUKS/dm-crypt on volumes; Postgres TDE or encrypted tablespaces; MinIO SSE-KMS; keys in **HashiCorp Vault** / on-prem HSM. |
| **Encryption in transit** | TLS 1.3 everywhere incl. service-to-service (mTLS via mesh or internal CA). HSTS at the edge. |

**Government requirements satisfied:**
- **Air-gap**: egress firewall DENY-ALL; models/images pre-staged; no telemetry.
- **Data residency**: all storage + inference in-country (see §5).
- **Auditability**: immutable trail, log integrity (hash-chained), SIEM export.
- **Least privilege**: RBAC + tenant isolation enforced below the application code.
- **Standards alignment**: maps to **NCA ECC** (KSA), **NESA/SIA** (UAE),
  ISO 27001, SOC 2 controls — encryption, access control, logging, BCP/DR (§8).
- **Key custody**: customer-held keys (Vault/HSM); operator never holds plaintext.

---

## 5. Data Sovereignty Patterns

Common rule for all three: **no external API call, no cloud dependency, full
local processing.** The differences are jurisdiction + hosting substrate.

| Region | Hosting substrate | Identity | Notes |
|---|---|---|---|
| **Saudi Arabia** | On-prem gov DC or **NCA-licensed CSP region** (in-Kingdom). GPU on local infra. | ADFS / Nafath federation via Keycloak | Align to **NCA ECC** + **SDAIA**/PDPL; data classified, kept in-Kingdom; Arabic-first UI |
| **UAE** | On-prem or **in-country sovereign cloud** (e.g., G42/local). | Azure AD (UAE tenant) / UAE Pass via Keycloak | **NESA IAS**, **SIA**, UAE PDPL; bilingual; data stays in-Emirates |
| **Egypt** | On-prem DC; constrained connectivity → fully offline install profile. | On-prem AD/ADFS | Egypt PDPL (Law 151/2020); offline model + package mirror; Arabic-first |

Deployment is identical (the `deploy/enterprise` compose / Helm chart); only the
**hosting location, IdP federation, and compliance attestations** change. A
single signed install bundle (images + Qwen2.5/BGE-M3 weights + SQL) is
transferred via approved media into the air-gapped zone.

---

## 6. Migration Strategy (Cloud → Enterprise)

Goal: move an existing Vercel/Neon/Claude customer on-prem with zero data loss
and a verifiable cutover.

1. **Provision** the on-prem stack (compose/Helm); pre-stage Qwen2.5 + BGE-M3.
2. **Database migration** — `pg_dump` from Neon → restore into on-prem Postgres
   (`pg_restore`). Schema is identical (same Prisma). Validate row counts.
3. **Vector migration** — two options:
   - *Re-embed (preferred for model change):* run the Phase-1 ingestion
     `reindexSource()` per org with `EMBEDDING_PROVIDER=ollama` so vectors are
     produced by the **local** BGE-M3 (dimension parity 1536). Cloud embeddings
     (OpenAI) and local must not be mixed — re-embed.
   - *Copy (same model):* `pg_dump` the `knowledge_chunks` table incl. the
     `vector` column, then `CREATE INDEX ... hnsw` on the target.
4. **Model migration** — point `LLM_PROVIDER=local`, `LLM_BASE_URL=http://vllm`.
   Optionally load the Phase-3 tuned adapter merged onto Qwen2.5.
5. **Object storage** — sync S3 documents/exports → MinIO (`mc mirror`), then
   flip `S3_ENDPOINT`.
6. **Auth** — create the Keycloak realm, federate the customer IdP, map groups
   to roles; migrate members (idempotent, by email).
7. **Cutover** — parallel run + checksum validation (counts, sampled RAG
   queries return same top-k, a fixture BOQ prices identically via the
   deterministic engine — `npm run test:boq`), then DNS flip + freeze cloud.
8. **Backup strategy** — nightly `pg_basebackup` + WAL archiving (PITR), MinIO
   versioning + offsite encrypted snapshot, model/weights checksummed in the
   artifact store. RPO ≤ 15 min (WAL), RTO ≤ 1 h (see DR, §8).

---

## 7. Cost Analysis (3-year TCO, indicative USD)

> Self-hosted is **CAPEX-heavy, OPEX-flat**; API is **zero CAPEX, usage-linear**.
> Crossover is driven by token volume, not user count alone. Tender processing
> is token-heavy (long bilingual docs), which pushes APIs up fast.

### Self-hosted CAPEX (hardware, one-time)

| Tier | GPUs | Server CAPEX | Notes |
|---|---|---|---|
| 50 users | 1× A100-40GB | ~$25–35k | single node + storage |
| 200 users | 2× A100-80GB | ~$70–110k | + OCR GPU, HA Postgres |
| 1000 users | 4–8× H100-80GB | ~$300–550k | redundant nodes, router |

### OPEX / month (indicative)

| | 50 users | 200 users | 1000 users |
|---|---|---|---|
| **Self-hosted** (power, DC, 0.5–2 FTE ops, support) | ~$2–4k | ~$6–10k | ~$20–35k |
| **Claude API** (Sonnet, ~heavy tender usage) | ~$3–6k | ~$12–25k | ~$60–120k+ |
| **OpenAI API** (GPT-4o-class) | ~$3–6k | ~$12–25k | ~$60–120k+ |

**Takeaways:**
- **≤ 50 users / light usage:** Claude API wins (no CAPEX; you've already shipped it).
- **200 users:** roughly break-even within year 1–2; self-host wins on data
  sovereignty (often the actual decision driver, not cost).
- **1000 users / gov:** self-hosted is **dramatically cheaper at steady state**
  and is frequently **mandatory** (no external API permitted) regardless of cost.
- API also carries **per-token data-exposure risk** that gov buyers will not accept.

---

## 8. Production Readiness Checklist

**Security**
- [ ] Egress firewall DENY-ALL verified (no outbound to anthropic/openai/vercel/neon).
- [ ] TLS 1.3 + internal CA; mTLS for service-to-service; HSTS at edge.
- [ ] Encryption at rest (LUKS + Postgres TDE + MinIO SSE); keys in Vault/HSM.
- [ ] SSO via Keycloak; Azure AD/ADFS federation; group→role mapping tested.
- [ ] RBAC + tenant isolation verified (cross-tenant RAG query returns 0 rows).
- [ ] Secrets in Vault, not env files; rotation policy; no secrets in logs.
- [ ] Pen test + NCA ECC / NESA control mapping signed off.

**Monitoring**
- [ ] Metrics: GPU util, vLLM queue depth/latency, Postgres, app (Prometheus/Grafana).
- [ ] Logs → SIEM (Splunk/QRadar); audit log integrity (hash chain) alerting.
- [ ] Health checks + alerting on vLLM/Ollama/DB; on-call runbook.

**Backup**
- [ ] Nightly base backup + continuous WAL archiving (PITR); RPO ≤ 15 min.
- [ ] MinIO versioning + offsite encrypted snapshot; restore drills passing.
- [ ] Model weights + adapters checksummed in the artifact store.

**Disaster Recovery**
- [ ] Documented RTO ≤ 1 h; standby Postgres replica; tested failover.
- [ ] Restore-from-cold runbook validated end-to-end (quarterly game day).

**AI Validation**
- [ ] `npm run test:boq` green (BigInt-exact pricing; deterministic core fenced).
- [ ] **TenderEval** acceptance gate passed on the frozen test set (extraction F1,
      Arabic F1, hallucination ≤ 0.5%, compliance acc, HIGH-risk recall).
- [ ] Guardrails verified: no agent emits a price; null qty → `INVALID_QUANTITY`;
      no-evidence compliance → `GAP`.
- [ ] Human-in-the-loop review enabled (feedback flywheel) for low-confidence outputs.

**Compliance**
- [ ] Data residency attested (in-country storage + inference).
- [ ] Data classification + retention/deletion policy implemented.
- [ ] DPIA / records-of-processing complete; PDPL (KSA/UAE/Egypt) mapping signed.
- [ ] Immutable audit trail exportable for auditors; access reviews scheduled.

---

### Implementation status in this repo
- ✅ LLM provider seam (`src/lib/ai/llm-provider.ts`) — `LLM_PROVIDER=local`.
- ✅ Embedding provider seam (`src/lib/ai/embedding-provider.ts`) — Ollama.
- ✅ All chat agents on the seam — extraction, compliance, clarification,
  proposal drafting (streaming), and RAG Q&A run on cloud Claude **or** local vLLM.
- ✅ Local-vision OCR (`OCR_PROVIDER=local-vision`) — poppler rasterize +
  Qwen2.5-VL via on-prem vLLM. Scanned PDFs no longer require Claude/Azure.
- ✅ Deterministic pricing + tenant-isolated pgvector RAG (cloud-agnostic).
- ✅ Reference air-gapped stack + Dockerfile (`deploy/enterprise/`).
- ✅ Helm chart (`deploy/enterprise/helm/tenderos`) — full k8s install: app,
  vLLM (chat), vLLM-VL (OCR), Ollama, Postgres+pgvector, Keycloak, MinIO,
  ingress; GPU scheduling, PVCs, secret strategy, all local-AI + OIDC env wired.
- ✅ OIDC auth adapter (`src/lib/auth/oidc.ts` + `/api/auth/oidc/*` + provider-
  aware middleware) — `AUTH_PROVIDER=oidc` federates Keycloak (→ Azure AD/ADFS).
  Server side is complete: login/callback/logout, JWKS-verified id_token, HS256
  session cookie, IdP-role → MemberRole RBAC, Org/Member upsert into the same
  schema. `getAuthContext()` delegates, so every existing server data path works
  unchanged on-prem.
- ⏳ Client-UI finishing for on-prem auth: the root `<ClerkProvider>` and the
  sidebar `<OrganizationSwitcher>/<UserButton>` must render conditionally when
  `AUTH_PROVIDER=oidc` (a small SSO "Sign in" button → `/api/auth/oidc/login`
  and a user menu → `/api/auth/oidc/logout`). Needs a running IdP to verify.
- ⏳ Last minor raw-Anthropic sites (`denoise-prompt`, `claude-secure`, legacy
  BOQ `extraction-prompt` — has a seam twin).

> With `LLM_PROVIDER=local` + `EMBEDDING_PROVIDER=ollama` + `OCR_PROVIDER=local-vision`,
> the **core pipeline makes zero external AI calls** — chat, embeddings, and OCR
> are all in-network.
