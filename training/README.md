# TenderOS — Domain Fine-Tuning (Qwen2.5-14B)

Training repo for the bilingual tender specialist (Phase 3). It consumes the
**de-identified JSONL** exported by the app (`Settings → Training Data`, or
`GET /api/internal/training-export`) and produces a LoRA adapter served via
vLLM behind the existing Next.js workflow.

> Reminder (from the strategy doc): we **never** fine-tune arithmetic/pricing.
> The deterministic BigInt engine + the guardrail gate stay in the app. Tuning
> only improves extraction, compliance reasoning, Arabic, and proposal voice.

## Pipeline

```
app export ──► data/  (sft.jsonl / dpo.jsonl)
   │
   ├─ src/data.py      validate + stratified train/val split (by task × language)
   ├─ src/train_sft.py QLoRA SFT  (Qwen2.5-14B-Instruct → outputs/sft-adapter)
   ├─ src/train_dpo.py DPO        (on top of the SFT adapter → outputs/dpo-adapter)
   ├─ eval/run_eval.py TenderEval KPIs vs acceptance thresholds (gate)
   └─ src/merge_adapter.py  merge LoRA → base for vLLM serving
```

## Quickstart

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 1. Pull data from the app (owner token / internal key), then split:
#    curl -H "x-internal-api-key: $INTERNAL_API_KEY" \
#      "$APP/api/internal/training-export?kind=sft&mark=1" -o data/sft.raw.jsonl
python -m src.data split --in data/sft.raw.jsonl --out data --kind sft
python -m src.data split --in data/dpo.raw.jsonl --out data --kind dpo   # optional

# 2. SFT (1× A100-80GB or H100; ~few GPU-hours at this scale)
python -m src.train_sft --config configs/sft_qwen2.5_14b.yaml

# 3. DPO (after enough EDIT pairs accumulate)
python -m src.train_dpo --config configs/dpo_qwen2.5_14b.yaml

# 4. Evaluate against the frozen test set + acceptance gate
python -m eval.run_eval --endpoint http://localhost:8000/v1 --model tenderos \
  --gold eval/datasets/tendereval.test.jsonl

# 5. Merge for serving, then run vLLM:
python -m src.merge_adapter --base Qwen/Qwen2.5-14B-Instruct \
  --adapter outputs/dpo-adapter --out outputs/merged
vllm serve outputs/merged --served-model-name tenderos --quantization awq
```

The app swaps Claude → this endpoint by pointing the workflow's model provider
at the vLLM OpenAI-compatible URL (mirrors the Phase-1 embedding-provider seam).

## Acceptance gate (from the strategy doc)
`eval/run_eval.py` exits non-zero unless every KPI clears its threshold, so it
can gate promotion in CI. See `eval/run_eval.py:THRESHOLDS`.
