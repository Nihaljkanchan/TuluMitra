"""Shared helpers for the training and evaluation scripts."""

import re
import unicodedata

ZERO_WIDTH = re.compile(r"[​‌‍﻿]")
PUNCT = re.compile(r"[\"“”‘’'`.,!?;:()\[\]{}।॥\-–—…]")


def clean_transcript(text: str) -> str:
    """What the model is trained to output: NFC, single spaces, no zero-width marks."""
    text = unicodedata.normalize("NFC", text or "")
    text = ZERO_WIDTH.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


def normalise_for_scoring(text: str) -> str:
    """Compare meaning, not punctuation: used for WER/CER only."""
    text = clean_transcript(text).lower()
    text = PUNCT.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def wer_cer(references, hypotheses):
    """Word and character error rate, after normalisation."""
    import jiwer

    refs = [normalise_for_scoring(r) for r in references]
    hyps = [normalise_for_scoring(h) for h in hypotheses]
    pairs = [(r, h) for r, h in zip(refs, hyps) if r]
    refs, hyps = [p[0] for p in pairs], [p[1] for p in pairs]
    return {"wer": round(jiwer.wer(refs, hyps), 4), "cer": round(jiwer.cer(refs, hyps), 4), "n": len(refs)}


def transcribe_all(model, processor, audio_paths, language="kannada", batch_size=8, device="cpu"):
    """Batch-transcribe a list of 16 kHz WAV files."""
    import soundfile as sf
    import torch

    out = []
    model.eval()
    for i in range(0, len(audio_paths), batch_size):
        batch = [sf.read(p)[0] for p in audio_paths[i:i + batch_size]]
        feats = processor.feature_extractor(batch, sampling_rate=16000, return_tensors="pt").input_features
        feats = feats.to(device, dtype=next(model.parameters()).dtype)
        with torch.no_grad():
            ids = model.generate(input_features=feats, language=language, task="transcribe", max_new_tokens=225)
        out.extend(t.strip() for t in processor.batch_decode(ids, skip_special_tokens=True))
    return out
