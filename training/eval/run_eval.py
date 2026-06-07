"""
TenderEval runner + acceptance gate.

Generates predictions from an OpenAI-compatible endpoint (vLLM serving the FT
model) over a frozen test set, computes the Phase-3 KPIs, prints a report, and
EXITS NON-ZERO if any KPI misses its threshold — so it can gate promotion in CI.

Gold test JSONL, one record per line:
  {"task": "...", "lang": "en|ar", "input": "<text>", "expected": {...json...},
   "meta": {"pair_id": "...", "risk": "HIGH"}}   # pair_id/risk optional

Run:
  python -m eval.run_eval --endpoint http://localhost:8000/v1 \
      --model tenderos --gold eval/datasets/tendereval.test.jsonl
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from typing import Any

from eval import metrics as M

# Acceptance thresholds (from docs/phase3-finetuning-strategy.md §5).
THRESHOLDS: dict[str, float] = {
    "extraction_f1": 0.95,
    "quantity_exact_match": 0.98,
    "compliance_accuracy": 0.90,
    "high_risk_recall": 0.95,
    "hallucination_rate": 0.005,        # MAX (lower is better)
    "arabic_extraction_f1": 0.92,
    "cross_language_consistency": 0.95,
}
# KPIs where a LOWER value is better.
LOWER_IS_BETTER = {"hallucination_rate"}

EXTRACTION_TASKS = {"requirement_extraction", "boq_classification", "scope_interpretation"}

SYSTEM = {
    "requirement_extraction": "Extract requirements as JSON {\"requirements\":[...]}. Never invent.",
    "boq_classification": "Extract BOQ line items as JSON {\"line_items\":[...]}. NEVER output a price.",
    "compliance_analysis": "Return JSON {\"status\":\"COMPLIANT|PARTIAL|GAP|UNKNOWN\",...} grounded in evidence only.",
    "risk_identification": "Return JSON {\"risks\":[{\"severity\":\"HIGH|MEDIUM|LOW\",...}]}.",
}


def _client(endpoint: str, api_key: str):
    from openai import OpenAI

    return OpenAI(base_url=endpoint, api_key=api_key)


def _generate(client, model: str, task: str, text: str) -> dict[str, Any]:
    try:
        resp = client.chat.completions.create(
            model=model,
            temperature=0,
            max_tokens=2048,
            messages=[
                {"role": "system", "content": SYSTEM.get(task, "Return strict JSON.")},
                {"role": "user", "content": text},
            ],
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content or "{}")
    except Exception as err:  # noqa: BLE001 — eval must be robust to a bad generation
        print(f"[eval] generation/parse failed ({task}): {err}", file=sys.stderr)
        return {}


def _items(obj: dict[str, Any]) -> list[dict]:
    for key in ("line_items", "requirements", "items", "included"):
        v = obj.get(key)
        if isinstance(v, list):
            return [x for x in v if isinstance(x, dict)]
    return []


def run(gold_path: str, endpoint: str, model: str, api_key: str) -> dict[str, float]:
    gold = [json.loads(l) for l in open(gold_path, encoding="utf-8") if l.strip()]

    ext_f1, qty_em, fab = [], [], []
    ar_f1: list[float] = []
    comp_pred, comp_gold = [], []
    risk_pred, risk_gold = [], []
    pairs: dict[str, dict[str, list[dict]]] = defaultdict(dict)

    for rec in gold:
        task, lang = rec.get("task"), rec.get("lang", "en")
        pred = _generate(_client(endpoint, api_key), model, task, rec["input"])
        exp = rec.get("expected", {})

        if task in EXTRACTION_TASKS:
            p_items, g_items = _items(pred), _items(exp)
            f1 = M.extraction_f1(p_items, g_items)
            ext_f1.append(f1)
            qty_em.append(M.quantity_exact_match(p_items, g_items))
            fab.append(M.fabrication_rate(p_items, g_items))
            if lang == "ar":
                ar_f1.append(f1)
            pid = (rec.get("meta") or {}).get("pair_id")
            if pid:
                pairs[pid][lang] = p_items
        elif task == "compliance_analysis":
            comp_pred.append(str(pred.get("status", "")))
            comp_gold.append(str(exp.get("status", "")))
        elif task == "risk_identification":
            def top(o: dict) -> str:
                rs = o.get("risks") or []
                sev = [str(r.get("severity", "")) for r in rs if isinstance(r, dict)]
                return "HIGH" if any(M.norm_text(s) == "high" for s in sev) else (sev[0] if sev else "")
            risk_pred.append(top(pred))
            risk_gold.append(top(exp))

    mean = lambda xs: sum(xs) / len(xs) if xs else 1.0  # noqa: E731
    cross_pairs = [(v["en"], v["ar"]) for v in pairs.values() if "en" in v and "ar" in v]

    return {
        "extraction_f1": mean(ext_f1),
        "quantity_exact_match": mean(qty_em),
        "hallucination_rate": (sum(fab) / len(fab)) if fab else 0.0,
        "arabic_extraction_f1": mean(ar_f1),
        "compliance_accuracy": M.label_accuracy(comp_pred, comp_gold),
        "high_risk_recall": M.recall_for_label(risk_pred, risk_gold, "HIGH"),
        "cross_language_consistency": M.cross_language_consistency(cross_pairs),
    }


def gate(results: dict[str, float]) -> bool:
    print("\n  KPI                          value      threshold   result")
    print("  " + "-" * 58)
    ok = True
    for kpi, thr in THRESHOLDS.items():
        val = results.get(kpi, 0.0)
        passed = (val <= thr) if kpi in LOWER_IS_BETTER else (val >= thr)
        cmp = "<=" if kpi in LOWER_IS_BETTER else ">="
        ok = ok and passed
        print(f"  {kpi:<28} {val:>7.3f}   {cmp}{thr:<8.3f}  {'PASS' if passed else 'FAIL'}")
    print("  " + "-" * 58)
    print(f"  GATE: {'PASS — promotable' if ok else 'FAIL — do not promote'}\n")
    return ok


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gold", required=True)
    ap.add_argument("--endpoint", default="http://localhost:8000/v1")
    ap.add_argument("--model", default="tenderos")
    ap.add_argument("--api-key", default="not-needed")  # vLLM ignores it
    ap.add_argument("--json", action="store_true", help="emit machine-readable JSON too")
    args = ap.parse_args()

    results = run(args.gold, args.endpoint, args.model, args.api_key)
    if args.json:
        print(json.dumps(results, indent=2))
    passed = gate(results)
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
