"""
Speech recognition with Whisper.

• Fast path (default when OPENAI_API_KEY is available):
  Uses OpenAI's cloud Whisper (whisper-1). Transcribes in ~1 second with
  high accuracy for English, Kannada, and Tulu without CPU strain or hallucination loops.
• Local path:
  • If training/train_whisper_lora.py has produced an adapter in
    models/whisper-tulu-lora/, it is loaded on top of the base model — this
    is your fine-tuned Tulu ASR.
  • Otherwise, if ASR_ALLOW_BASE_MODEL is on, the base model is used with
    the requested language (or Kannada as Tulu proxy). Anti-hallucination
    repetition penalties and silence filters prevent runaway loops.
• Needs ML packages (pip install -r requirements-ml.txt) only when using local Whisper.
"""

import logging
import re
import threading
from pathlib import Path

import config

log = logging.getLogger(__name__)


class ASRUnavailable(RuntimeError):
    pass


class ASR:
    def __init__(self):
        self.model = None
        self.processor = None
        self.device = "cpu"
        self.adapter_loaded = False
        self.error = None
        self._lock = threading.Lock()

    def _deps(self):
        try:
            import torch  # noqa: F401
            import transformers  # noqa: F401
            return True
        except ImportError:
            return False

    def _can_use_openai(self) -> bool:
        if config.ASR_MODE == "off":
            return False
        if config.ASR_PROVIDER == "local":
            return False
        return bool(config.OPENAI_API_KEY)

    def status(self) -> dict:
        has_adapter = config.WHISPER_ADAPTER_DIR.exists()
        use_openai = self._can_use_openai()

        if config.ASR_MODE == "off":
            state = "off"
        elif use_openai:
            state = "ready (OpenAI whisper-1 API)"
        elif not self._deps():
            state = "missing ML packages (pip install -r requirements-ml.txt)"
        elif not has_adapter and not config.ASR_ALLOW_BASE_MODEL:
            state = "no trained adapter yet"
        else:
            state = "loaded" if self.model is not None else "ready (loads on first request)"

        return {
            "state": state,
            "provider": "openai" if use_openai else "local",
            "base_model": "whisper-1 (api)" if use_openai else config.WHISPER_BASE_MODEL,
            "fine_tuned_adapter": str(config.WHISPER_ADAPTER_DIR.relative_to(config.BASE_DIR)) if has_adapter else None,
            "language_token": config.WHISPER_LANGUAGE,
            "error": self.error,
        }

    def _clean_transcript(self, text: str) -> str:
        if not text:
            return ""
        text = text.strip()
        # Remove repeated single-character loops (e.g. ööööööö or ಸಿರಿööö)
        text = re.sub(r'(.)\1{3,}', r'\1', text).strip()
        # Remove repeating word loops (e.g. "and and and and")
        text = re.sub(r'(\b\w+\b)(?:\s+\1){3,}', r'\1', text, flags=re.IGNORECASE).strip()
        # Remove lone punctuation artifacts
        if len(text) <= 1 and not text.isalnum():
            return ""
        return text

    def _is_silence(self, wav_path: Path, threshold: float = 0.003) -> bool:
        try:
            import numpy as np
            import soundfile as sf
            data, _ = sf.read(str(wav_path))
            if data.size == 0:
                return True
            rms = np.sqrt(np.mean(data ** 2))
            return float(rms) < threshold
        except Exception:
            return False

    def _transcribe_openai(self, wav_path: Path, language: str = "tulu") -> str:
        from openai import OpenAI
        client = OpenAI(api_key=config.OPENAI_API_KEY)

        lang_lower = (language or "").strip().lower()
        kwargs = {"model": "whisper-1"}

        if lang_lower in ("english", "en"):
            kwargs["language"] = "en"
        elif lang_lower in ("kannada", "kn"):
            kwargs["language"] = "kn"
        else:
            # Tulu context prompt to guide spelling & phonetics
            kwargs["prompt"] = "ತುಳು ಭಾಷೆ (Tulu language): ಸೊಲ್ಮೆಲು, ಎಂಚ ಉಲ್ಲರ್, ಎಂಕ್ ಎಡ್ಡೆ ಉಂಡು, ಈರೆನ ಪುದರ್ ದಾದ, ವನಸ್ ಆಂಡಾ, ಆಂಡ್, ಆತಿಜಿ, ಬೊಕ್ಕ ತಿಕ್ಕುಗ, ದಾದ."

        with open(str(wav_path), "rb") as f:
            kwargs["file"] = f
            res = client.audio.transcriptions.create(**kwargs)
            return self._clean_transcript(res.text)

    def _load_local(self):
        if self.model is not None:
            return
        if config.ASR_MODE == "off":
            raise ASRUnavailable("Speech recognition is turned off (ASR_MODE=off)")
        if not self._deps():
            raise ASRUnavailable("ML packages are not installed on this server")
        has_adapter = config.WHISPER_ADAPTER_DIR.exists()
        if not has_adapter and not config.ASR_ALLOW_BASE_MODEL:
            raise ASRUnavailable("No fine-tuned Tulu ASR model yet")

        import torch
        from transformers import WhisperForConditionalGeneration, WhisperProcessor

        self.device = "cuda" if (config.DEVICE in ("auto", "cuda") and torch.cuda.is_available()) else "cpu"
        log.info("Loading Whisper %s on %s …", config.WHISPER_BASE_MODEL, self.device)
        model = WhisperForConditionalGeneration.from_pretrained(config.WHISPER_BASE_MODEL)
        proc_source = config.WHISPER_BASE_MODEL
        if has_adapter:
            from peft import PeftModel

            model = PeftModel.from_pretrained(model, str(config.WHISPER_ADAPTER_DIR))
            model = model.merge_and_unload()
            self.adapter_loaded = True
            if (config.WHISPER_ADAPTER_DIR / "preprocessor_config.json").exists():
                proc_source = str(config.WHISPER_ADAPTER_DIR)
            log.info("Loaded fine-tuned adapter from %s", config.WHISPER_ADAPTER_DIR)
        self.processor = WhisperProcessor.from_pretrained(proc_source)
        model.to(self.device).eval()
        self.model = model

    def _transcribe_local(self, wav_path: Path, language: str = "tulu") -> str:
        self._load_local()

        import soundfile as sf
        import torch

        audio, sr = sf.read(str(wav_path))
        if audio.ndim > 1:
            audio = audio.mean(axis=1)

        lang_lower = (language or "").strip().lower()
        if lang_lower in ("english", "en"):
            target_lang = "english"
        elif lang_lower in ("kannada", "kn"):
            target_lang = "kannada"
        else:
            target_lang = config.WHISPER_LANGUAGE or "kannada"

        inputs = self.processor(audio, sampling_rate=sr, return_tensors="pt")
        features = inputs.input_features.to(self.device)

        gen_kwargs = {
            "language": target_lang,
            "task": "transcribe",
            "max_new_tokens": 100,
            "no_repeat_ngram_size": 3,
            "repetition_penalty": 1.2,
            "condition_on_previous_text": False,
        }

        with torch.no_grad():
            ids = self.model.generate(features, **gen_kwargs)
        raw = self.processor.batch_decode(ids, skip_special_tokens=True)[0].strip()
        return self._clean_transcript(raw)

    def transcribe(self, wav_path, language: str = "tulu") -> str:
        # Check for silence or background hiss to avoid hallucination loops
        if self._is_silence(Path(wav_path)):
            return ""

        # Try OpenAI Whisper API first (fastest, most accurate)
        if self._can_use_openai():
            try:
                return self._transcribe_openai(Path(wav_path), language)
            except Exception as exc:
                log.warning("OpenAI Whisper API failed (%s); falling back to local model", exc)

        # Fallback to local Whisper
        with self._lock:
            try:
                return self._transcribe_local(Path(wav_path), language)
            except ASRUnavailable:
                raise
            except Exception as exc:
                self.error = str(exc)[:300]
                log.exception("Could not load/run local Whisper")
                raise ASRUnavailable("The speech model could not be loaded") from exc
