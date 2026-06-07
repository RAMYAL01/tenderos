"""
Direct Preference Optimization for Qwen2.5-14B — refines the SFT adapter on
(prompt, chosen, rejected) pairs that come from the app's EDIT feedback
(chosen = human-corrected output, rejected = original AI draft).

Run: python -m src.train_dpo --config configs/dpo_qwen2.5_14b.yaml
"""

from __future__ import annotations

import argparse

import torch
import yaml
from datasets import load_dataset
from peft import LoraConfig, PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from trl import DPOConfig, DPOTrainer


def load_cfg(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    cfg = load_cfg(ap.parse_args().config)

    compute_dtype = getattr(torch, cfg.get("bnb_4bit_compute_dtype", "bfloat16"))
    quant = BitsAndBytesConfig(
        load_in_4bit=cfg.get("load_in_4bit", True),
        bnb_4bit_quant_type=cfg.get("bnb_4bit_quant_type", "nf4"),
        bnb_4bit_compute_dtype=compute_dtype,
        bnb_4bit_use_double_quant=cfg.get("bnb_4bit_use_double_quant", True),
    )

    tokenizer = AutoTokenizer.from_pretrained(cfg["base_model"], use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Load base in 4-bit, then attach the SFT adapter as the trainable policy.
    base = AutoModelForCausalLM.from_pretrained(
        cfg["base_model"],
        quantization_config=quant,
        torch_dtype=compute_dtype,
        device_map="auto",
    )
    model = PeftModel.from_pretrained(base, cfg["sft_adapter"], is_trainable=True)

    lora = LoraConfig(
        r=cfg.get("lora_r", 32),
        lora_alpha=cfg.get("lora_alpha", 64),
        lora_dropout=cfg.get("lora_dropout", 0.05),
        target_modules=cfg.get("lora_target_modules"),
        bias="none",
        task_type="CAUSAL_LM",
    )

    data_files = {"train": cfg["train_file"]}
    if cfg.get("eval_file"):
        data_files["validation"] = cfg["eval_file"]
    ds = load_dataset("json", data_files=data_files)

    dpo_args = DPOConfig(
        output_dir=cfg["output_dir"],
        beta=cfg.get("beta", 0.1),
        max_length=cfg.get("max_seq_len", 4096),
        max_prompt_length=cfg.get("max_prompt_len", 2048),
        num_train_epochs=cfg.get("num_train_epochs", 1),
        per_device_train_batch_size=cfg.get("per_device_train_batch_size", 1),
        gradient_accumulation_steps=cfg.get("gradient_accumulation_steps", 16),
        learning_rate=float(cfg.get("learning_rate", 5e-6)),
        lr_scheduler_type=cfg.get("lr_scheduler_type", "cosine"),
        warmup_ratio=cfg.get("warmup_ratio", 0.1),
        logging_steps=cfg.get("logging_steps", 10),
        save_strategy=cfg.get("save_strategy", "epoch"),
        eval_strategy="epoch" if cfg.get("eval_file") else "no",
        bf16=cfg.get("bf16", True),
        gradient_checkpointing=cfg.get("gradient_checkpointing", True),
        seed=cfg.get("seed", 42),
        report_to="none",
    )

    trainer = DPOTrainer(
        model=model,
        ref_model=None,  # PEFT: reference = base policy with adapters disabled
        args=dpo_args,
        train_dataset=ds["train"],
        eval_dataset=ds.get("validation"),
        processing_class=tokenizer,
        peft_config=lora,
    )

    trainer.train()
    trainer.save_model(cfg["output_dir"])
    print(f"[dpo] adapter saved to {cfg['output_dir']}")


if __name__ == "__main__":
    main()
