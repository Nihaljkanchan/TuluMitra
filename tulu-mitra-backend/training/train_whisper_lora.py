"""
Step 2 — fine-tune Whisper on your Tulu recordings with LoRA.

Run on a GPU (Google Colab T4 is enough for whisper-small):
    python training/train_whisper_lora.py
    python training/train_whisper_lora.py --epochs 15 --base openai/whisper-small

What it does
  • loads training/processed/{train,test}.csv from prepare_dataset.py
  • freezes Whisper and trains small LoRA matrices on the attention
    q_proj / v_proj layers (r=8, alpha=32 — the configuration you already
    validated: ~0.36% of whisper-small's parameters are trainable)
  • uses Kannada as the language token: Whisper has no Tulu token, Tulu is
    written in Kannada script, and the two are phonologically close
  • keeps the checkpoint with the lowest validation loss
  • measures WER and CER on the test set, for the base model and the
    fine-tuned one, and writes them to models/whisper-tulu-lora/metrics.json
  • saves only the adapter (a few MB) + processor to models/whisper-tulu-lora/

Copy that folder into the backend's models/ directory and restart — /asr
picks it up automatically.
"""

import argparse
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
from common import transcribe_all, wer_cer  # noqa: E402


def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=HERE / "processed")
    ap.add_argument("--base", default="openai/whisper-small")
    ap.add_argument("--out", type=Path, default=ROOT / "models" / "whisper-tulu-lora")
    ap.add_argument("--language", default="kannada")
    ap.add_argument("--epochs", type=float, default=10)
    ap.add_argument("--lr", type=float, default=1e-3, help="LoRA tolerates a higher LR than full fine-tuning")
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--grad-accum", type=int, default=2)
    ap.add_argument("--lora-r", type=int, default=8)
    ap.add_argument("--lora-alpha", type=int, default=32)
    ap.add_argument("--lora-dropout", type=float, default=0.05)
    ap.add_argument("--skip-baseline", action="store_true", help="don't score the untuned model")
    ap.add_argument("--seed", type=int, default=42)
    return ap.parse_args()


@dataclass
class Collator:
    """Pads audio features and label ids separately; label padding → -100 (ignored by the loss)."""

    processor: object
    decoder_start_token_id: int

    def __call__(self, features):
        inputs = [{"input_features": f["input_features"]} for f in features]
        batch = self.processor.feature_extractor.pad(inputs, return_tensors="pt")
        labels = self.processor.tokenizer.pad([{"input_ids": f["labels"]} for f in features], return_tensors="pt")
        ids = labels["input_ids"].masked_fill(labels.attention_mask.ne(1), -100)
        if (ids[:, 0] == self.decoder_start_token_id).all().cpu().item():
            ids = ids[:, 1:]  # the model adds the start token itself
        batch["labels"] = ids
        return batch


def main():
    args = parse_args()
    import pandas as pd
    import torch
    from datasets import Dataset
    from peft import LoraConfig, PeftModel, get_peft_model
    from transformers import (Seq2SeqTrainer, Seq2SeqTrainingArguments, WhisperForConditionalGeneration,
                              WhisperProcessor, set_seed)

    set_seed(args.seed)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        print("WARNING: no GPU found — training will be very slow. On Colab: Runtime → Change runtime type → T4 GPU.")

    train_df = pd.read_csv(args.data / "train.csv")
    test_df = pd.read_csv(args.data / "test.csv")
    print(f"train {len(train_df)} clips · test {len(test_df)} clips")

    processor = WhisperProcessor.from_pretrained(args.base, language=args.language, task="transcribe")

    import soundfile as sf

    # Audio is read with soundfile directly (files are already 16 kHz mono
    # from prepare_dataset.py) — this avoids depending on whichever audio
    # backend the installed `datasets` version expects.
    def prepare(batch):
        array, sr = sf.read(batch["audio"])
        batch["input_features"] = processor.feature_extractor(array, sampling_rate=sr).input_features[0]
        batch["labels"] = processor.tokenizer(batch["text"]).input_ids
        return batch

    def to_dataset(df):
        ds = Dataset.from_pandas(df[["audio", "text"]], preserve_index=False)
        return ds.map(prepare, remove_columns=["audio", "text"])

    train_ds, test_ds = to_dataset(train_df), to_dataset(test_df)

    # ---------------------------------------------------------- baseline
    metrics = {"base_model": args.base, "language_token": args.language,
               "train_clips": len(train_df), "test_clips": len(test_df),
               "train_minutes": round(train_df["duration"].sum() / 60, 1),
               "test_minutes": round(test_df["duration"].sum() / 60, 1)}
    refs = test_df["text"].tolist()
    if not args.skip_baseline:
        print("Scoring the untuned model on the test set …")
        base = WhisperForConditionalGeneration.from_pretrained(args.base).to(device)
        hyps = transcribe_all(base, processor, test_df["audio"].tolist(), args.language, device=device)
        metrics["baseline"] = wer_cer(refs, hyps)
        print("  baseline:", metrics["baseline"])
        del base
        torch.cuda.empty_cache() if device == "cuda" else None

    # -------------------------------------------------------------- LoRA
    model = WhisperForConditionalGeneration.from_pretrained(args.base)
    model.config.forced_decoder_ids = None
    model.generation_config.language = args.language
    model.generation_config.task = "transcribe"
    lora = LoraConfig(r=args.lora_r, lora_alpha=args.lora_alpha, lora_dropout=args.lora_dropout,
                      target_modules=["q_proj", "v_proj"], bias="none")
    model = get_peft_model(model, lora)
    model.print_trainable_parameters()

    work_dir = args.out.parent / (args.out.name + "-checkpoints")
    training_args = Seq2SeqTrainingArguments(
        output_dir=str(work_dir),
        per_device_train_batch_size=args.batch,
        per_device_eval_batch_size=args.batch,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        warmup_ratio=0.1,
        num_train_epochs=args.epochs,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        fp16=device == "cuda",
        logging_steps=10,
        remove_unused_columns=False,  # PEFT wraps the model; keep our columns
        label_names=["labels"],
        report_to=[],
        seed=args.seed,
    )
    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=test_ds,
        data_collator=Collator(processor, model.config.decoder_start_token_id),
    )
    t0 = time.time()
    trainer.train()
    metrics["train_minutes_wallclock"] = round((time.time() - t0) / 60, 1)
    metrics["best_eval_loss"] = trainer.state.best_metric

    # -------------------------------------------------------------- save
    args.out.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(args.out))       # adapter only
    processor.save_pretrained(str(args.out))
    print("Saved adapter to", args.out)

    # ------------------------------------------------ fine-tuned scoring
    print("Scoring the fine-tuned model on the test set …")
    tuned = WhisperForConditionalGeneration.from_pretrained(args.base)
    tuned = PeftModel.from_pretrained(tuned, str(args.out)).merge_and_unload().to(device)
    hyps = transcribe_all(tuned, processor, test_df["audio"].tolist(), args.language, device=device)
    metrics["fine_tuned"] = wer_cer(refs, hyps)
    metrics["examples"] = [{"reference": r, "prediction": h} for r, h in list(zip(refs, hyps))[:15]]
    (args.out / "metrics.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\n================ RESULTS ================")
    if "baseline" in metrics:
        print(f"  Base Whisper     WER {metrics['baseline']['wer']:.1%}   CER {metrics['baseline']['cer']:.1%}")
    print(f"  Fine-tuned LoRA  WER {metrics['fine_tuned']['wer']:.1%}   CER {metrics['fine_tuned']['cer']:.1%}")
    print(f"  Test set: {metrics['test_clips']} clips ({metrics['test_minutes']} min)")
    print("  Full details:", args.out / "metrics.json")


if __name__ == "__main__":
    main()
