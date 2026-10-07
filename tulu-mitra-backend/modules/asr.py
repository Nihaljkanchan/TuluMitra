"""
Speech recognition with Whisper.

• If training/train_whisper_lora.py has produced an adapter in
  models/whisper-tulu-lora/, it is loaded on top of the base model — this
  is your fine-tuned Tulu ASR.
• Otherwise, if ASR_ALLOW_BASE_MODEL is on, the base model is used with
  Kannada as the proxy language. It runs, but accuracy on Tulu will be poor
  until you fine-tune; /health reports which of the two is active.
• Needs the ML requirements (pip install -r requirements-ml.txt). Without
  them /asr answers 503 and the rest of the API keeps working.

The model loads on the first request (it takes a while), not at startup.
"""

import logging
import threading

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

    def status(self) -> dict:
        has_adapter = config.WHISPER_ADAPTER_DIR.exists()
        if config.ASR_MODE == "off":
            state = "off"
        elif not self._deps():
            state = "missing ML packages (pip install -r requirements-ml.txt)"
        elif not has_adapter and not config.ASR_ALLOW_BASE_MODEL:
            state = "no trained adapter yet"
        else:
            state = "loaded" if self.model is not None else "ready (loads on first request)"
        return {
            "state": state,
            "base_model": config.WHISPER_BASE_MODEL,
            "fine_tuned_adapter": str(config.WHISPER_ADAPTER_DIR.relative_to(config.BASE_DIR)) if has_adapter else None,
            "language_token": config.WHISPER_LANGUAGE,
            "error": self.error,
        }

    def _load(self):
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
            model = model.merge_and_unload()  # plain Whisper again, with Tulu weights folded in
            self.adapter_loaded = True
            if (config.WHISPER_ADAPTER_DIR / "preprocessor_config.json").exists():
                proc_source = str(config.WHISPER_ADAPTER_DIR)
            log.info("Loaded fine-tuned adapter from %s", config.WHISPER_ADAPTER_DIR)
        self.processor = WhisperProcessor.from_pretrained(proc_source)
        model.to(self.device).eval()
        self.model = model

    def transcribe(self, wav_path) -> str:
        with self._lock:
            try:
                self._load()
            except ASRUnavailable:
                raise
            except Exception as exc:  # download failure, out of memory …
                self.error = str(exc)[:300]
                log.exception("Could not load Whisper")
                raise ASRUnavailable("The speech model could not be loaded") from exc

            import soundfile as sf
            import torch

            audio, sr = sf.read(str(wav_path))
            if audio.ndim > 1:
                audio = audio.mean(axis=1)
            inputs = self.processor(audio, sampling_rate=sr, return_tensors="pt")
            features = inputs.input_features.to(self.device)
            with torch.no_grad():
                ids = self.model.generate(
                    features, language=config.WHISPER_LANGUAGE, task="transcribe", max_new_tokens=225
                )
            return self.processor.batch_decode(ids, skip_special_tokens=True)[0].strip()
