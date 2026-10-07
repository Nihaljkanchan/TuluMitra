"""
Voice samples for personalised speech.

/upload-voice stores the sample (converted to 16 kHz mono WAV) and returns
a voice_id. The frontend keeps that id and sends it with /tts when the
visitor picks "My voice" in the Voice menu.

This is NOT training. Personalisation (VOICE_CONVERSION=knnvc) uses kNN-VC
(github.com/bshall/knn-vc, "Voice Conversion With Just Nearest Neighbors",
Interspeech 2023), which needs no training on the new voice:
  1. the answer is first spoken by the normal Tulu Mitra voice (tts.py);
  2. kNN-VC cuts that speech into ~20 ms frames and swaps each frame for the
     most similar frames of the uploaded sample (WavLM features), then a
     vocoder turns the result back into audio.
It works with a short sample and gets closer with more reference audio (its
authors report gains up to about 5 minutes).

First use downloads the model from GitHub through torch.hub: the WavLM-Large
encoder (~1.2 GB) and the HiFi-GAN vocoder (~60 MB). That can take several
minutes, so /upload-voice starts it in the background and /voice/status
reports progress. After that it is cached on disk.
"""

import logging
import re
import threading
import time
import uuid

import config
from modules.audio_utils import duration_seconds, to_wav

log = logging.getLogger(__name__)

ID_RE = re.compile(r"^[a-f0-9]{16}$")
SR = 16000
MAX_CACHED_SETS = 8


class VoiceStore:
    def __init__(self):
        self._knnvc = None
        self._lock = threading.Lock()      # one conversion at a time
        self._sets = {}                    # voice_id -> matching set (features of the sample)
        self.state = "off" if config.VOICE_CONVERSION != "knnvc" else "not loaded"
        self.error = None
        self.loading_since = None

    # ------------------------------------------------------------- samples
    def save(self, upload_path):
        voice_id = uuid.uuid4().hex[:16]
        dst = config.VOICES_DIR / f"{voice_id}.wav"
        to_wav(upload_path, dst)
        seconds = duration_seconds(dst)
        warning = None
        if seconds < config.VOICE_MIN_SECONDS:
            warning = f"Sample is {seconds:.1f}s — at least {config.VOICE_MIN_SECONDS}s works better."
        return {"voice_id": voice_id, "seconds": round(seconds, 1), "warning": warning,
                "personalisation": config.VOICE_CONVERSION == "knnvc"}

    def path(self, voice_id):
        if not voice_id or not ID_RE.match(voice_id):
            return None
        p = config.VOICES_DIR / f"{voice_id}.wav"
        return p if p.exists() else None

    def sample_info(self, voice_id):
        p = self.path(voice_id)
        if not p:
            return {"exists": False}
        return {"exists": True, "seconds": round(duration_seconds(p), 1)}

    @property
    def enabled(self):
        return config.VOICE_CONVERSION == "knnvc"

    # --------------------------------------------------------------- model
    @staticmethod
    def deps_missing():
        missing = []
        for mod in ("torch", "torchaudio", "soundfile", "librosa"):
            try:
                __import__(mod)
            except ImportError:
                missing.append(mod)
        return missing

    def _load(self):
        """Load kNN-VC (downloads on first use). Safe to call repeatedly."""
        if self._knnvc is not None:
            return
        import torch

        self.state, self.loading_since, self.error = "loading", time.time(), None
        device = "cuda" if (config.DEVICE in ("auto", "cuda") and torch.cuda.is_available()) else "cpu"
        log.info("Loading kNN-VC on %s (first time downloads ~1.3 GB from GitHub) …", device)
        try:
            try:
                self._knnvc = torch.hub.load("bshall/knn-vc", "knn_vc", prematched=True, trust_repo=True,
                                             pretrained=True, device=device)
            except TypeError:  # older hubconf without a device argument
                self._knnvc = torch.hub.load("bshall/knn-vc", "knn_vc", prematched=True, trust_repo=True,
                                             pretrained=True)
        except Exception as exc:
            self.state, self.error = "error", f"Could not load kNN-VC: {str(exc)[:240]}"
            log.exception("kNN-VC failed to load")
            raise
        self.state = "ready"
        log.info("kNN-VC ready (%.0fs)", time.time() - self.loading_since)

    @staticmethod
    def _read_16k(path):
        """Audio file → 1-D float tensor at 16 kHz, read with soundfile.
        (Newer torchaudio versions need an extra package to load files, so
        files are never loaded through torchaudio here.)"""
        import librosa
        import soundfile as sf
        import torch

        wav, sr = sf.read(str(path), dtype="float32", always_2d=True)
        wav = wav.mean(axis=1)
        if sr != SR:
            wav = librosa.resample(wav, orig_sr=sr, target_sr=SR)
        return torch.from_numpy(wav).float()

    def _matching_set(self, voice_id):
        if voice_id in self._sets:
            return self._sets[voice_id]
        import librosa

        wav = self._read_16k(self.path(voice_id))
        trimmed, _ = librosa.effects.trim(wav.numpy(), top_db=35)  # drop silence at the ends
        import torch

        feats = self._knnvc.get_matching_set([torch.from_numpy(trimmed)], vad_trigger_level=0)
        if len(self._sets) >= MAX_CACHED_SETS:
            self._sets.pop(next(iter(self._sets)))
        self._sets[voice_id] = feats
        return feats

    def prepare(self, voice_id=None):
        """Load the model (and this sample's features) in the background."""
        if not self.enabled or self.deps_missing() or self.state == "loading":
            return

        def run():
            with self._lock:
                try:
                    self._load()
                    if voice_id and self.path(voice_id):
                        self._matching_set(voice_id)
                except Exception:  # state/error already recorded
                    pass

        threading.Thread(target=run, daemon=True, name="knnvc-prepare").start()

    def convert(self, src_wav, dst_wav, voice_id):
        """Write dst_wav: the speech in src_wav, in the voice of the sample."""
        import soundfile as sf

        with self._lock:
            self._load()
            matching = self._matching_set(voice_id)
            query = self._knnvc.get_features(self._read_16k(src_wav), vad_trigger_level=0)
            out = self._knnvc.match(query, matching, topk=4)
        sf.write(str(dst_wav), out.cpu().numpy(), SR)

    # -------------------------------------------------------------- status
    def status(self, voice_id=None):
        missing = self.deps_missing() if self.enabled else []
        state = "missing packages" if missing else self.state
        return {
            "enabled": self.enabled,
            "state": state,
            "error": self.error,
            "missing": missing,
            "loading_seconds": int(time.time() - self.loading_since) if state == "loading" and self.loading_since else None,
            "sample": self.sample_info(voice_id) if voice_id else None,
        }
