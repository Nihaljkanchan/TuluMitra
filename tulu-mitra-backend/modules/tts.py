"""
Text-to-speech. Engines are tried in this order:

1. tulu_vits — a VITS model fine-tuned on YOUR Tulu recordings, placed in
   models/tulu-tts/ (see training/README.md, "Training a Tulu voice").
2. indic_parler — AI4Bharat's Indic Parler-TTS (ai4bharat/indic-parler-tts,
   Apache-2.0): a natural Indian Kannada voice ("Suresh" or "Anu", set with
   TTS_SPEAKER) reading the Kannada-script Tulu. Used when the parler-tts
   package is installed. Best pronunciation of the stand-ins, but slow on
   a CPU (several seconds per sentence) — results are cached.
3. kannada_proxy — Meta's MMS Kannada voice (facebook/mms-tts-kan, licence
   CC-BY-NC 4.0) reading the Kannada-script Tulu text. It is a Kannada
   voice, not a Tulu one: pronunciation will be close but not native.
   Responses report the engine so the UI can say so.
4. none — returns no audio; the frontend falls back to the best Indian voice
   in the viewer's browser.

Optional personalisation: with VOICE_CONVERSION=knnvc and a voice_id from
/upload-voice, the output is converted toward that person's voice.
"""

import hashlib
import logging
import threading

import config

log = logging.getLogger(__name__)

MAX_CACHED_FILES = 500


class TTS:
    def __init__(self, voices):
        self.voices = voices
        self.engine = None
        self.model = None
        self.tokenizer = None
        self.description_ids = None
        self.error = None
        self.loading = False
        self._lock = threading.Lock()

    @staticmethod
    def _deps():
        try:
            import torch  # noqa: F401
            import transformers  # noqa: F401
            return True
        except ImportError:
            return False

    @staticmethod
    def _parler_installed():
        try:
            import parler_tts  # noqa: F401
            return True
        except ImportError:
            return False

    def planned_engine(self):
        if config.TTS_MODE == "off" or not self._deps():
            return None
        if config.TULU_TTS_DIR.exists():
            return "tulu_vits"
        if config.INDIC_TTS_ENABLED and self._parler_installed() and self.error is None:
            return "indic_parler"
        if config.TTS_KANNADA_PROXY:
            return "kannada_proxy"
        return None

    def status(self):
        planned = self.planned_engine()
        return {
            "engine": planned,
            "state": ("off" if config.TTS_MODE == "off" else
                      "missing ML packages" if not self._deps() else
                      "no engine configured" if not planned else
                      "loaded" if self.model is not None else
                      "loading" if self.loading else "ready (loads on first request)"),
            "is_tulu_voice": planned == "tulu_vits",
            "speaker": config.TTS_SPEAKER if planned == "indic_parler" else None,
            "voice_conversion": config.VOICE_CONVERSION,
            "error": self.error,
        }

    def _load(self):
        if self.model is not None:
            return
        engine = self.planned_engine()
        if not engine:
            return
        from transformers import AutoTokenizer

        if engine == "indic_parler":
            from parler_tts import ParlerTTSForConditionalGeneration
            import torch

            self.device = "cuda" if (config.DEVICE in ("auto", "cuda") and torch.cuda.is_available()) else "cpu"
            log.info("Loading TTS indic_parler (%s) on %s …", config.INDIC_TTS_MODEL, self.device)
            self.model = ParlerTTSForConditionalGeneration.from_pretrained(config.INDIC_TTS_MODEL).to(self.device).eval()
            self.tokenizer = AutoTokenizer.from_pretrained(config.INDIC_TTS_MODEL)
            desc_tok = AutoTokenizer.from_pretrained(self.model.config.text_encoder._name_or_path)
            description = f"{config.TTS_SPEAKER} {config.TTS_STYLE}"
            self.description_ids = desc_tok(description, return_tensors="pt").to(self.device)
            self.engine = engine
            return

        from transformers import VitsModel

        source = str(config.TULU_TTS_DIR) if engine == "tulu_vits" else config.KANNADA_TTS_MODEL
        log.info("Loading TTS %s (%s) …", engine, source)
        self.model = VitsModel.from_pretrained(source).eval()
        self.tokenizer = AutoTokenizer.from_pretrained(source)
        self.engine = engine

    def _prepare_text(self, text):
        # Some MMS tokenizers expect romanised input; use uroman if so.
        if getattr(self.tokenizer, "is_uroman", False):
            try:
                import uroman

                return uroman.Uroman().romanize_string(text)
            except ImportError:
                log.warning("This TTS model expects romanised text: pip install uroman")
        return text

    def warmup(self):
        """Load the speech model in the background, so the first play is quick."""
        if self.model is not None or self.loading or not self.planned_engine():
            return

        def run():
            with self._lock:
                try:
                    self._load_safely()
                except Exception:
                    pass

        threading.Thread(target=run, daemon=True, name="tts-warmup").start()

    def _load_safely(self):
        self.loading = True
        try:
            try:
                self._load()
            except Exception as exc:
                self.error = str(exc)[:300]
                log.exception("Could not load TTS model")
                self.model = None
                self._load()  # the next engine in line, once
        finally:
            self.loading = False

    def _generate(self, text, out):
        import soundfile as sf
        import torch

        if self.engine == "indic_parler":
            prompt = self.tokenizer(text, return_tensors="pt").to(self.device)
            with torch.no_grad():
                gen = self.model.generate(
                    input_ids=self.description_ids.input_ids,
                    attention_mask=self.description_ids.attention_mask,
                    prompt_input_ids=prompt.input_ids,
                    prompt_attention_mask=prompt.attention_mask,
                )
            wav = gen.cpu().numpy().squeeze()
        else:
            inputs = self.tokenizer(self._prepare_text(text), return_tensors="pt")
            with torch.no_grad():
                wav = self.model(**inputs).waveform[0].cpu().numpy()
        sf.write(str(out), wav, self.model.config.sampling_rate)

    def synthesize(self, text: str, voice_id: str = None):
        """Speak `text`. Returns a dict:
            file          name inside AUDIO_DIR, or None when no engine is available
            engine        which engine spoke
            personalised  True if the audio was converted to the uploaded voice
            note          why personalisation was not applied, if it was asked for
        """
        result = {"file": None, "engine": None, "personalised": False, "note": None}
        text = (text or "").strip()
        if not text:
            return result
        with self._lock:
            try:
                self._load_safely()
            except Exception:
                return result
            if self.model is None:
                return result
            speaker = config.TTS_SPEAKER if self.engine == "indic_parler" else ""
            base = hashlib.sha1(f"{self.engine}|{speaker}|{text}".encode("utf-8")).hexdigest()[:20] + ".wav"
            base_path = config.AUDIO_DIR / base
            if not base_path.exists():
                self._generate(text, base_path)
        result.update(file=base, engine=self.engine)

        # Personalisation, if asked for. Failure never blocks speech: the
        # default voice is returned with a note saying why.
        if voice_id:
            if not self.voices.enabled:
                result["note"] = "Personalisation is off on the server (VOICE_CONVERSION=off)."
            elif not self.voices.path(voice_id):
                result["note"] = "Your voice sample was not found on the server. Please upload it again."
            else:
                name = hashlib.sha1(f"{base}|{voice_id}".encode("utf-8")).hexdigest()[:20] + ".wav"
                path = config.AUDIO_DIR / name
                try:
                    if not path.exists():
                        self.voices.convert(base_path, path, voice_id)
                    result.update(file=name, personalised=True)
                except Exception as exc:
                    log.warning("Voice conversion failed, using the default voice: %s", exc)
                    path.unlink(missing_ok=True)  # never cache a half-made file
                    result["note"] = f"Voice conversion failed: {str(exc)[:200]}"

        self._trim_cache()
        return result

    @staticmethod
    def _trim_cache():
        files = sorted(config.AUDIO_DIR.glob("*.wav"), key=lambda p: p.stat().st_mtime)
        for p in files[:-MAX_CACHED_FILES]:
            p.unlink(missing_ok=True)
