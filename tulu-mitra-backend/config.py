"""
Every setting in one place. Values come from environment variables (or a
.env file next to this one), so nothing secret is written in code.

Copy .env.example to .env and edit it.
"""

import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).with_name(".env"))
except ImportError:  # python-dotenv is optional
    pass

BASE_DIR = Path(__file__).resolve().parent


def _bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _path(name, default):
    p = Path(os.getenv(name, default))
    return p if p.is_absolute() else BASE_DIR / p


# --- Server -----------------------------------------------------------------
# Comma-separated list of sites allowed to call this API from a browser.
# "*" is fine while developing; set your real frontend URL in production.
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "15"))
# Public base URL of this backend, used to build absolute audio links.
# Leave empty to return relative links (/audio/...), which the frontend
# resolves against VITE_API_URL anyway.
PUBLIC_URL = os.getenv("PUBLIC_URL", "").rstrip("/")

# --- Admin page -------------------------------------------------------------
# The password for the website's Admin page (review mistake reports, edit
# the word list, lessons and greetings). Leave empty to switch the Admin
# page off. Use a long password; it is checked on every admin request.
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

# --- Data -------------------------------------------------------------------
DATA_DIR = _path("DATA_DIR", "data")
# The cleaned Tulu Wikipedia corpus (73,872 sentences, made by
# training/clean_corpus.py from the 83,704-line original). Falls back to the
# small sample if the file is missing.
CORPUS_FILE = _path("CORPUS_FILE", "data/Tulu_Corpus_clean.txt")
SAMPLE_CORPUS_FILE = DATA_DIR / "sample_corpus.txt"
LEXICON_FILE = DATA_DIR / "tulu_lexicon.json"
LESSONS_FILE = _path("LESSONS_FILE", "data/tulu_lessons.json")
LIPI_FILE = DATA_DIR / "tulu_lipi_map.json"
# Approved corrections, exported as training data for the next training run.
CORRECTIONS_EXPORT = _path("CORRECTIONS_EXPORT", "training/data/corrections.tsv")

# --- Runtime storage (created automatically) --------------------------------
STORAGE_DIR = _path("STORAGE_DIR", "storage")
AUDIO_DIR = STORAGE_DIR / "audio"      # generated speech, served at /audio/<file>
VOICES_DIR = STORAGE_DIR / "voices"    # uploaded voice samples
UPLOADS_DIR = STORAGE_DIR / "uploads"  # temporary ASR uploads
for _d in (AUDIO_DIR, VOICES_DIR, UPLOADS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# --- Conversation (optional LLM) --------------------------------------------
# With an API key set, questions the rule-based modules can't answer go to a
# language model. Without one, the backend says it doesn't know rather than
# guessing. Keys are read here only; never commit them.
#
# Either provider works — set ONE key:
#   OPENAI_API_KEY=sk-...        (OpenAI; model: OPENAI_MODEL, default gpt-5-mini)
#   ANTHROPIC_API_KEY=sk-ant-... (Claude; model: LLM_MODEL, default claude-sonnet-5)
# With both set, LLM_PROVIDER=openai or anthropic picks one (default: openai).
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5-mini")


def _provider():
    wanted = os.getenv("LLM_PROVIDER", "auto").strip().lower()
    if wanted == "openai":
        return "openai" if OPENAI_API_KEY else None
    if wanted == "anthropic":
        return "anthropic" if ANTHROPIC_API_KEY else None
    return "openai" if OPENAI_API_KEY else "anthropic" if ANTHROPIC_API_KEY else None


LLM_PROVIDER = _provider()
LLM_MODEL = OPENAI_MODEL if LLM_PROVIDER == "openai" else os.getenv("LLM_MODEL", "claude-sonnet-5")
LLM_ENABLED = LLM_PROVIDER is not None and _bool("LLM_ENABLED", True)

# --- Speech recognition (Whisper) -------------------------------------------
# "auto": use OpenAI Whisper API if OPENAI_API_KEY is set, else local Whisper;
# "openai": force OpenAI Whisper API; "local": force local HuggingFace Whisper; "off": never.
ASR_PROVIDER = os.getenv("ASR_PROVIDER", "auto").strip().lower()
ASR_MODE = os.getenv("ASR_MODE", "auto").lower()
WHISPER_BASE_MODEL = os.getenv("WHISPER_BASE_MODEL", "openai/whisper-small")
# Where training/train_whisper_lora.py saves its LoRA adapter. If this folder
# exists, it is loaded on top of the base model automatically.
WHISPER_ADAPTER_DIR = _path("WHISPER_ADAPTER_DIR", "models/whisper-tulu-lora")
# Whisper has no Tulu language token. Tulu is written in Kannada script and
# is phonologically close, so Kannada is used as the proxy language — the
# same choice the training script makes. Keep the two in sync.
WHISPER_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "kannada")
# Without a trained adapter, should the base model still be used? It will
# transcribe Tulu speech as Kannada as best it can — useful for testing the
# pipeline, but expect poor accuracy until you fine-tune.
ASR_ALLOW_BASE_MODEL = _bool("ASR_ALLOW_BASE_MODEL", True)

# --- Speech synthesis -------------------------------------------------------
# "auto": use the best engine available; "off": never synthesise.
TTS_MODE = os.getenv("TTS_MODE", "auto").lower()
# A VITS model you fine-tuned on your Tulu recordings (see training/README).
TULU_TTS_DIR = _path("TULU_TTS_DIR", "models/tulu-tts")
# Stand-in until then: Meta's MMS Kannada voice reading the Kannada-script
# Tulu text. It is a Kannada voice, not a Tulu one, and responses say so.
TTS_KANNADA_PROXY = _bool("TTS_KANNADA_PROXY", True)
KANNADA_TTS_MODEL = os.getenv("KANNADA_TTS_MODEL", "facebook/mms-tts-kan")
# Indian voice: AI4Bharat's Indic Parler-TTS (Apache-2.0), natural Kannada
# speakers "Suresh" (male) and "Anu" (female). Used automatically when the
# parler-tts package is installed (see README, "Indian voice"); slower than
# MMS on a CPU, so the MMS voice remains the fallback.
INDIC_TTS_MODEL = os.getenv("INDIC_TTS_MODEL", "ai4bharat/indic-parler-tts")
INDIC_TTS_ENABLED = _bool("INDIC_TTS_ENABLED", True)
TTS_SPEAKER = os.getenv("TTS_SPEAKER", "Suresh")
TTS_STYLE = os.getenv("TTS_STYLE", "speaks clearly with a moderate pace and pitch, in a close-sounding, high quality recording.")

# --- Voice personalisation --------------------------------------------------
# "knnvc": convert synthesized speech toward the user's uploaded sample with
# kNN-VC (language-independent voice conversion). "off": store samples only.
VOICE_CONVERSION = os.getenv("VOICE_CONVERSION", "off").lower()
VOICE_MIN_SECONDS = 6
VOICE_MAX_SECONDS = 30

DEVICE = os.getenv("DEVICE", "auto")  # "auto", "cpu" or "cuda"
