"""
Data loading + validation for the TenderOS fine-tuning corpus.

Consumes the de-identified JSONL exported by the app:
  - SFT : {"messages": [{role, content}...], "meta": {task, lang, ...}}
  - DPO : {"prompt": str, "chosen": str, "rejected": str, "meta": {...}}

Provides:
  - load_sft / load_dpo          -> validated lists of records
  - split (CLI)                   -> stratified train/val split by (task × lang)

Defensive: every record is schema-checked and bad lines are skipped with a
counted warning rather than crashing a multi-hour run.
"""

from __future__ import annotations

import argparse
import json
import os
import random
from collections import defaultdict
from typing import Any, Iterable


# ── loading + validation ──────────────────────────────────────────────────────

def _read_jsonl(path: str) -> Iterable[dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as fh:
        for i, line in enumerate(fh, 1):
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                print(f"[data] skipping malformed JSON at {path}:{i}")


def _valid_sft(rec: dict[str, Any]) -> bool:
    msgs = rec.get("messages")
    if not isinstance(msgs, list) or len(msgs) < 2:
        return False
    roles = {m.get("role") for m in msgs if isinstance(m, dict)}
    if "user" not in roles or "assistant" not in roles:
        return False
    return all(isinstance(m.get("content"), str) and m["content"] for m in msgs)


def _valid_dpo(rec: dict[str, Any]) -> bool:
    return (
        isinstance(rec.get("prompt"), str)
        and isinstance(rec.get("chosen"), str)
        and isinstance(rec.get("rejected"), str)
        and rec["chosen"] != rec["rejected"]
        and bool(rec["prompt"])
    )


def load_sft(path: str) -> list[dict[str, Any]]:
    out, bad = [], 0
    for rec in _read_jsonl(path):
        if _valid_sft(rec):
            out.append(rec)
        else:
            bad += 1
    print(f"[data] SFT: {len(out)} valid, {bad} skipped from {path}")
    return out


def load_dpo(path: str) -> list[dict[str, Any]]:
    out, bad = [], 0
    for rec in _read_jsonl(path):
        if _valid_dpo(rec):
            out.append(rec)
        else:
            bad += 1
    print(f"[data] DPO: {len(out)} valid, {bad} skipped from {path}")
    return out


# ── stratified split ──────────────────────────────────────────────────────────

def _stratum(rec: dict[str, Any]) -> str:
    meta = rec.get("meta") or {}
    return f"{meta.get('task', 'unknown')}::{meta.get('lang', 'unknown')}"


def stratified_split(
    records: list[dict[str, Any]], val_frac: float = 0.1, seed: int = 42
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Split each (task × language) stratum independently so val mirrors train."""
    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in records:
        buckets[_stratum(r)].append(r)

    rng = random.Random(seed)
    train, val = [], []
    for _, items in sorted(buckets.items()):
        rng.shuffle(items)
        n_val = max(1, int(round(len(items) * val_frac))) if len(items) > 1 else 0
        val.extend(items[:n_val])
        train.extend(items[n_val:])
    rng.shuffle(train)
    rng.shuffle(val)
    return train, val


def _write_jsonl(path: str, rows: list[dict[str, Any]]) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")


def _cli() -> None:
    ap = argparse.ArgumentParser(description="Validate + stratified-split TenderOS training JSONL.")
    ap.add_argument("cmd", choices=["split"])
    ap.add_argument("--in", dest="inp", required=True, help="raw exported JSONL")
    ap.add_argument("--out", dest="out", default="data", help="output dir")
    ap.add_argument("--kind", choices=["sft", "dpo"], required=True)
    ap.add_argument("--val-frac", type=float, default=0.1)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    records = load_sft(args.inp) if args.kind == "sft" else load_dpo(args.inp)
    if not records:
        raise SystemExit("[data] no valid records — nothing to split.")

    train, val = stratified_split(records, args.val_frac, args.seed)
    _write_jsonl(os.path.join(args.out, f"{args.kind}.train.jsonl"), train)
    _write_jsonl(os.path.join(args.out, f"{args.kind}.val.jsonl"), val)
    print(f"[data] wrote {len(train)} train / {len(val)} val to {args.out}/")


if __name__ == "__main__":
    _cli()
