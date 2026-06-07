"""
QLoRA Supervised Fine-Tuning for Qwen2.5-14B-Instruct.

Trains on the SFT chat JSONL (messages format). 4-bit base + LoRA adapters;
loss masked to assistant tokens by TRL's SFTTrainer using the Qwen chat
template. Saves the adapter to output_dir.

Run: python -m src.train_sft --config configs/sft_qwen2.5_14b.yaml
"""

from __future__ import annotations

import argparse

import torch
import yaml
from datasets import load_dataset
from peft import LoraConfig
from transformers import AutoTokenizer, BitsAndBytesConfig
from trl import SFTConfig, SFTTrainer


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

    sft_args = SFTConfig(
        output_dir=cfg["output_dir"],
        max_seq_length=cfg.get("max_seq_len", 4096),
        packing=cfg.get("packing", True),
        num_train_epochs=cfg.get("num_train_epochs", 3),
        per_device_train_batch_size=cfg.get("per_device_train_batch_size", 2),
        gradient_accumulation_steps=cfg.get("gradient_accumulation_steps", 8),
        learning_rate=float(cfg.get("learning_rate", 1e-4)),
        lr_scheduler_type=cfg.get("lr_scheduler_type", "cosine"),
        warmup_ratio=cfg.get("warmup_ratio", 0.03),
        weight_decay=cfg.get("weight_decay", 0.0),
        max_grad_norm=cfg.get("max_grad_norm", 1.0),
        logging_steps=cfg.get("logging_steps", 10),
        save_strategy=cfg.get("save_strategy", "epoch"),
        eval_strategy=cfg.get("eval_strategy", "no") if cfg.get("eval_file") else "no",
        bf16=cfg.get("bf16", True),
        gradient_checkpointing=cfg.get("gradient_checkpointing", True),
        seed=cfg.get("seed", 42),
        report_to="none",
        # TRL applies the model's chat template to the `messages` column.
        dataset_kwargs={"add_special_tokens": False},
    )

    trainer = SFTTrainer(
        model=cfg["base_model"],
        args=sft_args,
        train_dataset=ds["train"],
        eval_dataset=ds.get("validation"),
        peft_config=lora,
        processing_class=tokenizer,
        model_init_kwargs={"quantization_config": quant, "torch_dtype": compute_dtype, "device_map": "auto"},
    )

    trainer.train()
    trainer.save_model(cfg["output_dir"])
    tokenizer.save_pretrained(cfg["output_dir"])
    print(f"[sft] adapter saved to {cfg['output_dir']}")


if __name__ == "__main__":
    main()
