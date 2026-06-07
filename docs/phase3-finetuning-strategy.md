# TenderOS — Phase 3: Domain-Specialized AI via Fine-Tuning

**Status:** Architecture / implementation-ready
**Owner:** ML Platform
**Scope:** A bilingual (AR/EN) domain expert for government tenders, EPC contracts, construction BOQs, procurement docs, compliance matrices, and technical proposals — that measurably beats general LLMs on tender tasks, at lower cost, with enterprise multi-tenant isolation.

---

## 0. Non-negotiable architectural principles (read first)

These constrain every decision below. They come directly from Phase 1 (tenant-isolated RAG) and Phase 2 (deterministic BOQ engine).

1. **Never fine-tune arithmetic or pricing.** The model is *forbidden* from producing quantities it didn't read or any price. Pricing stays in the deterministic BigInt engine (`lib/financial/boq`) reading the org rate catalogue. Fine-tuning targets **extraction, classification, compliance reasoning, scope interpretation, risk phrasing, and proposal drafting** — never math. This is what makes "100% deterministic math, zero hallucinated price" a *structural* guarantee, not a hope.
2. **Facts live in RAG, form lives in weights.** Tenant-specific facts (their rates, past projects, client names) are retrieved at inference via Phase-1 `tenantChunkSearch`. They are **never** baked into shared weights — that would leak Company A's data into Company B's model. Fine-tuning teaches *domain language, schema fidelity, Arabic competence, and reasoning patterns*.
3. **Tenant isolation extends to weights.** Default model = a **shared domain base** trained only on de-identified/public/synthetic tender data. Optional **per-tenant LoRA adapters** capture a client's proposal voice, loaded only for that org. No cross-tenant weight contamination.
4. **The guardrail gate is deterministic, not a model.** Every model output passes the validators in §7 (provenance, schema, coverage, evidence-citation) before a user sees it. The model proposes; deterministic code disposes.
5. **Measure against the incumbent.** "Better" = beats the current Claude baseline on Arabic extraction + cost without regressing English, and passes 100% of guardrails. No vibes.

---

## 1. Dataset Strategy

### 1.1 Source taxonomy & schema

One normalized `TrainingExample` record per labeled unit. Source documents are mined from the existing app tables plus curated public corpora.

| Doc type | Primary source (in-app) | Public/synthetic augmentation | Target tasks |
|---|---|---|---|
| Tender / RFP | `Document` (READY) + OCR text | Etimad (KSA), UAE/Qatar e-tender portals, World Bank/UN procurement notices | scope, requirement extraction, risk |
| BOQ | `Document` BOQ pages, `BoqWorkflow.extraction` | Standard method-of-measurement BOQs (CESMM/POMI/SMM7) | BOQ classification, extraction |
| Technical specs | `Document` | Master specs (e.g. SBC, NEC, FIDIC clauses) | scope interpretation, requirement extraction |
| Scope of work | `Document` | — | scope interpretation |
| Compliance matrix | `ComplianceMatrixRow` + `Requirement` | — | compliance analysis |
| Historical proposals | `Proposal` / `ProposalSection` (consented) | — | proposal generation (DPO) |
| Clarification requests | `clarifications` data | — | clarification generation |
| Vendor submissions | uploaded comparisons | — | extraction, comparison |

**Canonical record (stored as Postgres + exported to JSONL):**

```jsonc
{
  "id": "te_…",
  "task": "requirement_extraction | compliance_analysis | risk_identification | proposal_generation | scope_interpretation | boq_classification",
  "lang": "ar | en | mixed",
  "source_doc_hash": "sha256(...)",     // dedup + provenance, NOT the raw doc
  "tender_id_hashed": "hmac(orgId, tenderId)", // tenant unlinkable in shared corpus
  "section_ref": "3.2.1",
  "span": { "page": 14, "char_start": 120, "char_end": 540 }, // grounding for every label
  "input": "…source text (chunk)…",
  "output": { /* strict JSON per task schema (mirrors Phase-2 zod) */ },
  "label_source": "human_gold | claude_silver | deterministic | human_corrected",
  "reviewer_role": "estimator | procurement_manager | proposal_manager | null",
  "quality": { "iaa": 0.91, "grounded": true, "schema_valid": true },
  "split": "train | val | test",
  "created_at": "…"
}
```

Two label tiers:
- **Gold** — human-verified (from the §6 feedback loop). Drives val/test and high-weight train.
- **Silver** — Claude-generated + deterministically/structurally checked (bootstraps volume). Used for train only, down-weighted.

### 1.2 Data cleaning

1. **OCR de-noise** — reuse the existing Azure/Claude OCR + cross-page table stitching; drop headers/footers/watermarks/page numbers; repair RTL/LTR token-merge (the known MENA failure mode).
2. **Structural parse** — segment into clauses, BOQ rows, spec sections (not raw pages). Keep `section_ref` + `span` offsets so every label is *grounded*.
3. **Redaction (mandatory for the shared corpus)** — strip/replace: client & vendor names, unit rates & prices, contact PII, bank/CR numbers, signatures. Rates and prices are commercial secrets **and** must never enter weights (principle 1). Per-tenant adapters may use un-redacted *own* data.
4. **Normalization** — units (`m²/SQM→m2`, `Nr/Nos→no`), numerals (Arabic-Indic ٠١٢٣→0123), date/currency formats, Arabic diacritics/orthography (alef/hamza/ya normalization), thousands separators stripped from quantities.
5. **Language tagging** — per-chunk script detection (`ar`/`en`/`mixed`) for stratified sampling.

### 1.3 Deduplication

- **Exact** — `sha256` over normalized text (`source_doc_hash`).
- **Near** — MinHash/LSH (Jaccard ≥ 0.85) for boilerplate clauses (FIDIC/SBC repeats across tenders) → keep one canonical + a frequency weight.
- **Semantic** — embedding cosine ≥ 0.97 (reuse the 1536-d pgvector pipeline) to catch paraphrased duplicates and prevent train/test leakage. **Dedup is computed across the whole corpus before splitting**, and splitting is by `source_doc_hash` (a doc never spans train+test).

### 1.4 Chunking methodology

**Structure-aware, not fixed-token** (reuse `lib/knowledge/chunk.ts` as the base, specialized per type):
- **BOQ** → one example per *row* (or stitched multi-page table), preserving column anchors.
- **Specs/clauses** → one example per numbered clause; keep parent section header as context prefix.
- **Compliance** → (requirement, evidence-chunks, verdict) triples.
- **Proposals** → (RFP requirement(s) + retrieved evidence) → section, for DPO pairs.
- Long sections: overlap = 1 sentence; never split a BOQ row or a numbered requirement mid-unit.

### 1.5 Data quality validation

- **Schema validation** — every `output` parses against its Phase-2 zod schema (extraction/compliance). Fail → reject.
- **Grounding check** — extracted quantities/codes must be substring-locatable in the `span` source; ungrounded → reject (this is the anti-hallucination signal baked into the *data*).
- **Inter-annotator agreement** — ≥ 2 reviewers on a 5% sample; Cohen's κ ≥ 0.80 to admit a labeler's batch.
- **Class balance** — stratify by task × language × doc-type; oversample Arabic (it's the differentiator and usually under-represented).
- **Leakage audit** — semantic-dedup gate between splits; assert 0 docs cross splits.
- **Holdout freeze** — `test` split is frozen and version-tagged; never used in any tuning or model selection beyond final reporting.

**Target volumes (v1):** ≥ 8–12k gold examples (≥ 40% Arabic) + ≥ 50k silver. Enough for LoRA SFT; full FT not justified at this scale.

---

## 2. Training Data Format (JSONL)

Chat format, system-prompt anchored, **structured-JSON outputs** (matches how the model is actually used inside the multi-agent workflow). Outputs mirror the Phase-2 zod schemas exactly.

**2.1 Requirement extraction (EN)**
```json
{"messages":[{"role":"system","content":"You are a tender requirement extractor. Extract atomic, mandatory/optional requirements with clause refs. Quote source spans. Never invent requirements or quantities."},{"role":"user","content":"<clause ref=\"3.2.1\">The Contractor shall hold a valid ISO 9001:2015 certificate and ISO 45001 for the duration of the works.</clause>"},{"role":"assistant","content":"{\"requirements\":[{\"clause_ref\":\"3.2.1\",\"text\":\"Hold a valid ISO 9001:2015 certificate for the duration of the works\",\"type\":\"MANDATORY\",\"category\":\"certification\"},{\"clause_ref\":\"3.2.1\",\"text\":\"Hold a valid ISO 45001 certificate for the duration of the works\",\"type\":\"MANDATORY\",\"category\":\"certification\"}]}"}]}
```

**2.2 Requirement extraction (AR)**
```json
{"messages":[{"role":"system","content":"أنت مُستخرِج متطلبات المناقصات. استخرج المتطلبات الإلزامية والاختيارية مع رقم البند. لا تختلق متطلبات أو كميات."},{"role":"user","content":"<بند رقم=\"4-1\">يجب أن يمتلك المقاول شهادة الأيزو 9001 وأن يقدم خطاب ضمان ابتدائي بنسبة 2% من قيمة العطاء.</بند>"},{"role":"assistant","content":"{\"requirements\":[{\"clause_ref\":\"4-1\",\"text\":\"امتلاك شهادة الأيزو 9001\",\"type\":\"MANDATORY\",\"category\":\"certification\"},{\"clause_ref\":\"4-1\",\"text\":\"تقديم خطاب ضمان ابتدائي بنسبة 2% من قيمة العطاء\",\"type\":\"MANDATORY\",\"category\":\"bid_bond\"}]}"}]}
```

**2.3 Compliance analysis (EN, RAG-grounded)**
```json
{"messages":[{"role":"system","content":"You are a compliance analyst. Classify the requirement using ONLY the company evidence. No evidence = GAP. Cite evidence titles."},{"role":"user","content":"Requirement: Contractor must have completed ≥3 metro FM projects in the last 5 years.\nEvidence 1 — Riyadh Metro FM 2021: '...3-year FM contract, 85 stations...'\nEvidence 2 — Doha Metro FM 2019: '...facilities management, signaling rooms...'"},{"role":"assistant","content":"{\"status\":\"PARTIAL\",\"risk\":\"MEDIUM\",\"rationale\":\"Two qualifying metro FM projects are evidenced (Riyadh 2021, Doha 2019); the requirement asks for three, so one short.\",\"evidence\":[\"Riyadh Metro FM 2021\",\"Doha Metro FM 2019\"]}"}]}
```

**2.4 Risk identification (AR)**
```json
{"messages":[{"role":"system","content":"أنت محلل مخاطر مناقصات. حدد المخاطر التعاقدية والمالية والزمنية مع شدتها."},{"role":"user","content":"<بند>غرامة تأخير 1% من قيمة العقد لكل أسبوع تأخير بحد أقصى 20%، مع مدة تنفيذ 8 أشهر لمشروع بنية تحتية.</بند>"},{"role":"assistant","content":"{\"risks\":[{\"type\":\"liquidated_damages\",\"severity\":\"HIGH\",\"description\":\"غرامة تأخير تصل إلى 20% من قيمة العقد مع مدة تنفيذ ضيقة (8 أشهر) لمشروع بنية تحتية\",\"mitigation\":\"تسعير احتياطي زمني وتحليل المسار الحرج قبل التقديم\"}]}"}]}
```

**2.5 Technical proposal generation (EN, DPO chosen/rejected)**
```json
{"prompt":"Write the 'Quality Management Approach' section for a metro FM bid. Requirements: ISO 9001, monthly KPI reporting. Evidence: Riyadh Metro FM 2021 (ISO 9001 certified, CAFM system).","chosen":"Our quality management is anchored in our ISO 9001:2015-certified system, proven on the Riyadh Metro FM contract (85 stations). We will deploy our CAFM platform to generate the monthly KPI dashboards required under Clause 7, with auditable evidence trails...","rejected":"We have a great quality management system and lots of experience. We always deliver high quality and will meet all your KPIs every month without any issues."}
```

**2.6 Scope interpretation (AR)**
```json
{"messages":[{"role":"system","content":"أنت مفسر نطاق العمل. لخّص حدود النطاق وما هو مشمول وما هو مستثنى."},{"role":"user","content":"نطاق العمل: تشغيل وصيانة أنظمة التكييف المركزي لمدة 3 سنوات، باستثناء استبدال المبردات (Chillers) والأعمال المدنية."},{"role":"assistant","content":"{\"included\":[\"تشغيل وصيانة أنظمة التكييف المركزي لمدة 3 سنوات\"],\"excluded\":[\"استبدال المبردات (Chillers)\",\"الأعمال المدنية\"],\"duration_months\":36,\"notes\":\"استبعاد استبدال المبردات يحوّل مخاطر الأصول الرأسمالية إلى المالك\"}}"}]}
```

**2.7 BOQ classification (EN)**
```json
{"messages":[{"role":"system","content":"Classify the BOQ line into trade/division and cost driver. Extract code, description, unit, quantity. NEVER output a price or compute a total."},{"role":"user","content":"2.1.4 | Supply and install 150mm thick reinforced concrete slab, grade C35 | m3 | 1,250"},{"role":"assistant","content":"{\"item_code\":\"2.1.4\",\"description\":\"Supply and install 150mm thick reinforced concrete slab, grade C35\",\"unit_of_measurement\":\"m3\",\"quantity\":1250,\"division\":\"03 - Concrete\",\"cost_driver\":\"material+labor\",\"work_section\":\"structural\"}"}]}
```

> Note every `assistant` output is JSON that passes a Phase-2 zod schema, and BOQ/extraction examples carry **no price** by construction.

---

## 3. Model Selection

Evaluated for **Arabic, technical reasoning, cost, self-hostability** (open-weights only — enterprise wants control + zero per-token cost at scale + data residency).

| Model | Arabic | Technical reasoning | Cost / self-host | License | Verdict |
|---|---|---|---|---|---|
| **Qwen2.5 (7B/14B/32B/72B)** | **Strong** (best open Arabic, native MSA + dialect exposure) | Strong (excellent at structured/JSON, math-adjacent reasoning) | Excellent (7–14B self-host cheap; AWQ/GPTQ) | Apache-2.0 | **Recommended base** |
| Llama 3.1 (8B/70B) | Moderate (Arabic added but weaker than Qwen) | Strong (esp. 70B) | Good (8B cheap, 70B heavy) | Llama Community (restrictions) | Strong EN fallback |
| DeepSeek V3 / R1-distill | Good | **Very strong reasoning** (R1) | V3 is huge MoE (hard to self-host cheaply); R1-distill-Qwen viable | MIT-ish | Reasoning distill option |
| Mistral (Nemo 12B / Small) | Weak | Good | Excellent efficiency | Apache-2.0 | EN-only / cost edge |

**Recommendation:**
- **Primary base: `Qwen2.5-14B-Instruct`** — best Arabic + strong JSON/technical reasoning + Apache-2.0 + fits one A100-80GB (or 2×L40S) at AWQ-INT4. This is the differentiator pick because **Arabic tender competence is where general models fail and where TenderOS wins**.
- **High-volume/cheap tier: `Qwen2.5-7B-Instruct`** — extraction & BOQ classification (deterministic schema tasks need competence, not genius); fits 1×L4/A10-24GB at INT4.
- **Reasoning tier (optional): `DeepSeek-R1-Distill-Qwen-14B`** — for risk identification / scope ambiguity where chain-of-thought helps.
- Keep **Claude (API)** as the fallback/teacher (silver labels, hard cases, A/B baseline). The FT model must *beat Claude on Arabic + cost*, not necessarily on everything.

---

## 4. Fine-Tuning Architecture

### 4.1 SFT — Supervised Fine-Tuning (LoRA/QLoRA)
- **Use for:** the deterministic-schema tasks — requirement extraction, BOQ classification, compliance classification, scope interpretation. These have a single correct structured answer; SFT teaches schema fidelity + Arabic + domain vocabulary.
- **Method:** QLoRA (4-bit) on Qwen2.5-14B, rank 16–32, on gold + down-weighted silver. ~2–4 epochs, packed sequences, loss masked to assistant tokens only.
- **Why LoRA not full FT:** at 8–12k gold examples, full FT overfits and is 10× the GPU cost; LoRA adapters are swappable (enables per-tenant adapters) and cheap to retrain weekly from the feedback loop.

### 4.2 DPO — Direct Preference Optimization
- **Use for:** open-ended generation where "correct" is a preference, not a schema — **technical proposal writing**, risk phrasing, clarification wording. There's no single right answer; estimators prefer specific/evidenced prose over generic fluff.
- **Data:** the §6 feedback loop yields `(prompt, chosen = human-edited/approved, rejected = original AI draft)` pairs natively. Run DPO **after** SFT on the same base.
- **Why not RLHF/PPO:** DPO is simpler, stable, and sufficient at this scale; PPO's reward-model overhead isn't justified.

### 4.3 RAG + Fine-Tuning Hybrid (the production model)
- **FT supplies:** Arabic competence, schema fidelity, domain reasoning, proposal voice (form).
- **RAG supplies:** tenant facts — their rates (→ deterministic engine), their past projects/certs (→ `tenantChunkSearch`), the specific tender text (facts).
- **Wiring:** the FT model **drops into the existing Phase-2 multi-agent workflow** — it replaces the Claude calls in the extraction & compliance agents; the deterministic financial router and guardrail gate are unchanged. RAG retrieval is unchanged (Phase-1).
- **Decision rule:** *Need a fact about this specific client/tender?* → RAG. *Need domain reasoning, Arabic, or schema discipline?* → FT weights. *Need a number computed?* → deterministic engine. Never the reverse.

```
RFP/BOQ text ──► [FT Qwen2.5: extract] ──► zod gate ──► [FT: compliance] ◄── RAG(tenant evidence)
                                                  └──► [deterministic BigInt engine] ◄── rate catalogue
                                                              └──► guardrail gate ──► user
```

---

## 5. Evaluation Framework

Held-out **TenderEval** suite (frozen test split + curated hard cases), reported per language. Baseline = current Claude pipeline.

| KPI | Metric | Acceptance threshold | Rationale |
|---|---|---|---|
| Extraction accuracy | Line/requirement F1 (code, desc, unit, qty) | **≥ 0.95**; **quantity exact-match ≥ 0.98** | Wrong qty = wrong bid |
| Compliance accuracy | Macro-F1 vs human gold; **HIGH-risk recall ≥ 0.95** | **≥ 0.90** macro-F1 | Missing a showstopper loses the bid |
| Hallucination rate | % outputs with ungrounded claim / fabricated qty or price | **≤ 0.5%** (price fabrication **= 0**, hard gate) | Core trust promise |
| Tender understanding | TenderQA accuracy (held-out Q&A over tenders) | **≥ 0.85** | Holistic comprehension |
| Arabic performance | Arabic extraction F1 | **≥ 0.92** (within 3 pts of EN) | The differentiator |
| Cross-language consistency | Requirement-set agreement on same tender EN vs AR | **≥ 0.95** | Bilingual bids must match |
| Cost | $ / 1M tokens vs Claude | **≥ 60% cheaper** at target volume | Business case |
| Latency | p95 per extraction | ≤ baseline | UX |

**Ship gate:** model is promoted only if it (a) **beats Claude on Arabic extraction + cost**, (b) does **not regress > 1 pt** on English extraction/compliance, and (c) passes **100%** of the §7 guardrails on the test set. Eval runs in CI on every adapter version; results stored per `model_version` for regression tracking.

---

## 6. Human Feedback Loop (RLHF data engine)

The feedback loop **is** the data flywheel — it turns daily usage by domain experts into next month's training set.

**Surfaces (reuse existing UIs):**
- **Estimators** → BOQ extraction & classification review (accept / edit qty-source / reject).
- **Procurement managers** → compliance matrix & risk review (confirm / override status / add evidence).
- **Proposal managers** → proposal editor (the edit diff *is* the DPO signal).

**Flow:**
```
AI output ──► expert review UI ──► action {accept | edit | reject + reason}
        └──► AIFeedback row (orgId, task, model_version, input_ref, ai_output, human_output, action, reviewer_role)
                 └── weekly triage ──► label QA (κ check) ──► versioned dataset
                       ├── accept/edit  → SFT gold (human_corrected)   ── teaches the fix
                       └── (ai_original, human_edit) → DPO pair         ── teaches the preference
```

**Mechanics (implementation-ready):**
- New `AIFeedback` Prisma model (tenant-scoped) captures every review action + the structured before/after. *(Code bridge — ready to build on request.)*
- A weekly export job (Vercel Cron, reuse existing cron infra) materializes JSONL per §2, de-identified for the shared corpus, per-tenant for adapters.
- **Closed loop:** corrections re-enter SFT; edits become DPO; rejections with reasons become hard negatives. Each retrain is version-tagged and must pass §5 gates before promotion.
- Incentive: reviewers see "your corrections improved the model" metrics — drives participation.

---

## 7. Safety & Guardrails (the deterministic gate)

No model output reaches a user without passing these **deterministic** checks (most already exist from Phase 2 — extended here). This is what prevents the four failure modes by *construction*, not by prompting.

| Failure mode | Guardrail (deterministic) | Action on violation |
|---|---|---|
| **Hallucinated quantity** | Every extracted quantity must be substring-locatable in the source span (provenance check). | Drop the number → `INVALID_QUANTITY` flag → human review |
| **Invented pricing** | The model's output schema has **no price field**. Any numeric in a price position is rejected. Pricing comes ONLY from the BigInt engine + rate catalogue. | Hard reject; never display |
| **Missing tender requirement** | Coverage check: extracted requirements vs structural scan (numbered clauses, mandatory keywords: "shall", "يجب", "إلزامي"). Unmatched mandatory clause → flag. | `NEEDS_REVIEW`, surface gap |
| **Incorrect compliance claim** | A `COMPLIANT`/`PARTIAL` verdict MUST cite a retrieved evidence chunk (Phase-1 RAG). Uncited positive verdict → downgraded. | Downgrade to `UNKNOWN` + flag |

Plus cross-cutting gates: **zod schema validation** on every output; **confidence thresholds** (low-confidence → human-in-the-loop); **citation enforcement** (claims link to source spans/evidence ids); **abstention** ("I don't have that in the documents") rewarded in training, hallucination penalized. The gate is identical whether the brain is Claude or the FT model — swapping models can't weaken safety.

---

## 8. Production Deployment

Serve the FT model via **vLLM** behind an internal inference gateway; the Next.js workflow calls it exactly where it calls Claude today (one provider swap in `lib/ai`).

### 8.1 GPU requirements (Qwen2.5)

| Model | Precision | GPU (min) | KV/throughput | Use |
|---|---|---|---|---|
| 7B | AWQ-INT4 | 1× L4 24GB / A10 | ~3–5k tok/s batched | extraction, BOQ class |
| 14B | AWQ-INT4 | 1× A100-80GB or 2× L40S-48GB | ~2–3k tok/s | primary (AR + reasoning) |
| 14B | FP16 | 1× A100-80GB / H100 | higher quality | eval/teacher |
| 32B | AWQ-INT4 | 1× A100-80GB / H100 | heavy | optional quality tier |

**Training:** QLoRA-14B fits **1× A100-80GB** (or 1× H100); a full SFT+DPO cycle on ~12k examples ≈ a few GPU-hours.

### 8.2 Storage
- Base weights: 14B FP16 ≈ 28 GB; AWQ-INT4 ≈ 8–9 GB. Per-tenant LoRA adapter ≈ 50–200 MB each.
- Training data + checkpoints + eval artifacts: ~100–500 GB object storage (versioned, encrypted).
- Postgres: feedback + dataset metadata (small); pgvector already provisioned.

### 8.3 Deployment options & monthly cost (order-of-magnitude)

| Option | Setup | Est. monthly | Notes |
|---|---|---|---|
| **Managed open-model API** (Together/Fireworks/Bedrock) | Qwen2.5 hosted, per-token | usage-based; ~70–90% cheaper than Claude at volume | fastest to ship; less control/residency |
| **Cloud self-host (recommended prod)** | 1× A100-80GB reserved (vLLM, autoscale to 0 off-hours) | **~$1.5k–2.5k** (reserved) / ~$2–3.5k on-demand | full control, data residency (KSA/UAE region), flat cost |
| **Cloud cheap tier** | 1× L4/A10 for 7B | **~$300–700** | extraction-only workloads |
| **On-prem self-host** | 1× A100/H100 box (capex ~$15–30k) + ops | electricity/ops only | for clients with zero-cloud / data-sovereignty mandates (pairs with the Phase-1 Ollama embedding fallback) |

**Business case:** at scale, replacing Claude API calls in extraction/compliance with a self-hosted Qwen2.5-14B targets **60–90% inference cost reduction** while *improving* Arabic accuracy — the measurable outcome that justifies Phase 3. The deterministic engine and RAG are unchanged, so the migration is a contained provider swap with the eval gate as the safety net.

---

## Rollout sequence (de-risked)

1. **Shadow** — run FT model alongside Claude on live traffic; log both; compare on §5 KPIs. No user impact.
2. **Canary** — FT model serves extraction + BOQ classification (lowest-risk, schema-bound) for opt-in orgs; guardrail gate unchanged.
3. **Expand** — compliance & scope once Arabic F1 ≥ 0.92 sustained.
4. **DPO** — proposal generation after enough feedback pairs accumulate.
5. **Per-tenant adapters** — offer enterprise clients a private adapter trained on their consented proposal corpus.

Every stage is reversible (provider flag) and gated by eval + guardrails.

---

### Immediately buildable bridges (code, on request)
- `AIFeedback` Prisma model + capture hooks in the compliance/proposal/BOQ review UIs (§6).
- `lib/training/export.ts` — mines `Requirement`, `ComplianceMatrixRow`, `BoqWorkflow`, `AIFeedback` → de-identified JSONL per §2.
- `lib/ai/provider.ts` — provider abstraction so the workflow swaps Claude ↔ vLLM(Qwen) via env (mirrors the Phase-1 embedding-provider pattern).
- `eval/tendereval/` — the §5 harness wired into CI.
```
