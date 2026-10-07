"""
Step 3 (optional) — re-score a trained adapter on any test CSV, and save
every prediction for error analysis in your report.

    python training/evaluate_asr.py
    python training/evaluate_asr.py --adapter models/whisper-tulu-lora --data training/processed/test.csv

Writes results/asr_eval.json (WER/CER) and results/asr_predictions.csv
(reference vs prediction per clip, with per-clip CER).
"""

import argparse
import csv
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
from common import normalise_for_scoring, transcribe_all, wer_cer  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=HERE / "processed" / "test.csv")
    ap.add_argument("--base", default="openai/whisper-small")
    ap.add_argument("--adapter", type=Path, default=ROOT / "models" / "whisper-tulu-lora")
    ap.add_argument("--language", default="kannada")
    ap.add_argument("--out", type=Path, default=ROOT / "results")
    args = ap.parse_args()

    import jiwer
    import pandas as pd
    import torch
    from peft import PeftModel
    from transformers import WhisperForConditionalGeneration, WhisperProcessor

    device = "cuda" if torch.cuda.is_available() else "cpu"
    df = pd.read_csv(args.data)
    processor = WhisperProcessor.from_pretrained(args.adapter if (args.adapter / "preprocessor_config.json").exists() else args.base)
    refs = df["text"].tolist()

    results = {}
    predictions = {}
    for name in ("base", "fine_tuned"):
        if name == "fine_tuned" and not args.adapter.exists():
            print("No adapter found at", args.adapter)
            continue
        model = WhisperForConditionalGeneration.from_pretrained(args.base)
        if name == "fine_tuned":
            model = PeftModel.from_pretrained(model, str(args.adapter)).merge_and_unload()
        model.to(device)
        hyps = transcribe_all(model, processor, df["audio"].tolist(), args.language, device=device)
        results[name] = wer_cer(refs, hyps)
        predictions[name] = hyps
        print(f"{name:11} WER {results[name]['wer']:.1%}  CER {results[name]['cer']:.1%}")

    args.out.mkdir(exist_ok=True)
    (args.out / "asr_eval.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    with open(args.out / "asr_predictions.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "speaker", "reference", *(f"{k}_prediction" for k in predictions), *(f"{k}_cer" for k in predictions)])
        for i, row in df.iterrows():
            preds = [predictions[k][i] for k in predictions]
            cers = [round(jiwer.cer(normalise_for_scoring(row["text"]) or " ", normalise_for_scoring(p) or " "), 3) for p in preds]
            w.writerow([row["id"], row["speaker"], row["text"], *preds, *cers])
    print("Saved", args.out / "asr_eval.json", "and", args.out / "asr_predictions.csv")


if __name__ == "__main__":
    main()
