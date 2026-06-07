"""
Merge a LoRA adapter into the base model for serving (vLLM loads a merged model
faster than base + adapter). Run on a box with enough RAM/VRAM for fp16 14B.

Run: python -m src.merge_adapter --base Qwen/Qwen2.5-14B-Instruct \
       --adapter outputs/dpo-adapter --out outputs/merged
"""

from __future__ import annotations

import argparse

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--adapter", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    base = AutoModelForCausalLM.from_pretrained(
        args.base, torch_dtype=torch.bfloat16, device_map="cpu"
    )
    merged = PeftModel.from_pretrained(base, args.adapter).merge_and_unload()
    merged.save_pretrained(args.out, safe_serialization=True)
    AutoTokenizer.from_pretrained(args.base).save_pretrained(args.out)
    print(f"[merge] merged model written to {args.out}")


if __name__ == "__main__":
    main()
