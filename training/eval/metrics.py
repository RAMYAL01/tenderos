"""
TenderEval metrics — the KPI implementations behind the acceptance gate.

All metrics operate on parsed JSON outputs (see run_eval.py for generation +
parsing). Designed to mirror the thresholds in the Phase-3 strategy doc.
"""

from __future__ import annotations

import re
from typing import Any


# ── normalization ─────────────────────────────────────────────────────────────

_AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def norm_text(s: Any) -> str:
    s = "" if s is None else str(s)
    s = s.translate(_AR_DIGITS).lower().strip()
    return re.sub(r"\s+", " ", s)


_UNIT_ALIASES = {
    # latin
    "sqm": "m2", "sq.m": "m2", "cum": "m3", "cu.m": "m3", "nos": "no", "nr": "no",
    "each": "no", "ea": "no", "ls.": "ls", "lumpsum": "ls", "hrs": "hr", "hour": "hr",
    "tonne": "ton", "mt": "ton",
    # arabic (digits already ASCII-folded by norm_text; ² ³ folded below)
    "م2": "m2", "م3": "m3", "عدد": "no", "طن": "ton", "ساعة": "hr", "ساعه": "hr",
    "كجم": "kg", "كغ": "kg", "لتر": "l", "متر": "m", "م": "m", "م.ط": "m", "مقطوعية": "ls",
}


def norm_unit(u: Any) -> str:
    u = norm_text(u).replace("²", "2").replace("³", "3").replace(" ", "")
    return _UNIT_ALIASES.get(u, u)


def _qty(v: Any) -> float | None:
    try:
        f = float(str(v).translate(_AR_DIGITS).replace(",", ""))
        return f if f == f else None  # drop NaN
    except (TypeError, ValueError):
        return None


def item_key(d: dict[str, Any]) -> tuple:
    """Identity of an extracted line/requirement for set-based F1."""
    return (
        norm_text(d.get("item_code") or d.get("clause_ref") or ""),
        norm_text(d.get("description") or d.get("text") or "")[:120],
        norm_unit(d.get("unit_of_measurement") or d.get("unit") or ""),
    )


# ── core metrics ──────────────────────────────────────────────────────────────

def prf1(pred: set, gold: set) -> tuple[float, float, float]:
    if not pred and not gold:
        return 1.0, 1.0, 1.0
    tp = len(pred & gold)
    p = tp / len(pred) if pred else 0.0
    r = tp / len(gold) if gold else 0.0
    f = (2 * p * r / (p + r)) if (p + r) else 0.0
    return p, r, f


def extraction_f1(pred_items: list[dict], gold_items: list[dict]) -> float:
    return prf1({item_key(d) for d in pred_items}, {item_key(d) for d in gold_items})[2]


def quantity_exact_match(pred_items: list[dict], gold_items: list[dict]) -> float:
    """Of gold items matched by key, fraction whose quantity matches exactly."""
    gold_by_key = {item_key(d): _qty(d.get("quantity")) for d in gold_items}
    pred_by_key = {item_key(d): _qty(d.get("quantity")) for d in pred_items}
    keys = [k for k in gold_by_key if k in pred_by_key]
    if not keys:
        return 0.0
    ok = sum(1 for k in keys if gold_by_key[k] is not None and gold_by_key[k] == pred_by_key[k])
    return ok / len(keys)


def fabrication_rate(pred_items: list[dict], gold_items: list[dict]) -> float:
    """Hallucination signal: fraction of predicted items absent from gold."""
    if not pred_items:
        return 0.0
    gold = {item_key(d) for d in gold_items}
    fabricated = sum(1 for d in pred_items if item_key(d) not in gold)
    return fabricated / len(pred_items)


def label_accuracy(preds: list[str], golds: list[str]) -> float:
    if not golds:
        return 1.0
    return sum(1 for p, g in zip(preds, golds) if norm_text(p) == norm_text(g)) / len(golds)


def recall_for_label(preds: list[str], golds: list[str], target: str) -> float:
    """Recall on a specific class (e.g. HIGH risk) — catch showstoppers."""
    idx = [i for i, g in enumerate(golds) if norm_text(g) == norm_text(target)]
    if not idx:
        return 1.0
    hit = sum(1 for i in idx if norm_text(preds[i]) == norm_text(target))
    return hit / len(idx)


def cross_language_consistency(pairs: list[tuple[list[dict], list[dict]]]) -> float:
    """Mean requirement-set agreement (Jaccard on codes/clauses) across EN/AR pairs."""
    if not pairs:
        return 1.0
    scores = []
    for en, ar in pairs:
        a = {item_key(d)[0] or item_key(d)[1] for d in en}
        b = {item_key(d)[0] or item_key(d)[1] for d in ar}
        if not a and not b:
            scores.append(1.0)
        else:
            scores.append(len(a & b) / max(1, len(a | b)))
    return sum(scores) / len(scores)
