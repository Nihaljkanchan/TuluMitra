"""
Translation between English, Kannada and Tulu.

Order of attempts, most trustworthy first:
  1. The curated word list — an exact word or phrase match.
  2. Language model (OpenAI API / LLM) — full sentence translation with accurate
     grammar, verb conjugation, and roman transliteration.
  3. Word-by-word gloss of lexicon words (only when LLM is unavailable).
  4. Honest "not available".
"""

import logging

from modules import llm
from modules.text_utils import is_kannada, norm

log = logging.getLogger(__name__)


class Translator:
    def __init__(self, dictionary):
        self.d = dictionary
        self._cache = {}

    def translate(self, text: str, source: str, target: str) -> dict:
        text = (text or "").strip()
        if not text:
            return {"translation": "", "transliteration": None, "method": "none"}

        source = (source or "english").strip().lower()
        target = (target or "tulu").strip().lower()
        cache_key = f"{source}:{target}:{norm(text)}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        # 1. Exact match from curated word list
        entry = None
        if source == "english":
            entry = self.d.find_english(text)
        elif source in ("kannada", "tulu"):
            entry = self.d.find_tulu(text)
        if entry:
            if target == "tulu":
                res = {"translation": entry["tulu"], "transliteration": entry.get("roman"), "method": "word list"}
                self._cache[cache_key] = res
                return res
            if target == "english" and entry.get("english"):
                res = {"translation": entry["english"], "transliteration": None, "method": "word list"}
                self._cache[cache_key] = res
                return res
            if target == "kannada" and entry.get("kannada"):
                res = {"translation": entry["kannada"][0], "transliteration": None, "method": "word list"}
                self._cache[cache_key] = res
                return res

        # 2. Language model / AI Translation for words, phrases, and full sentences
        if llm.available():
            data = llm.translate_text(text, source, target)
            if data and data.get("translation"):
                res = {
                    "translation": data["translation"],
                    "transliteration": data.get("roman") or None,
                    "method": "ai",
                    "note": "AI translation — please verify with a Tulu speaker.",
                }
                self._cache[cache_key] = res
                return res

        # 3. Fallback word-by-word gloss (only if LLM is unavailable)
        if source == "english" and target == "tulu":
            pieces = [self.d.find_english(w) for w in norm(text).split()]
            known = [p for p in pieces if p and not p.get("number")]
            if known and len(known) == len([w for w in norm(text).split() if len(w) > 2]):
                return {
                    "translation": " · ".join(p["tulu"] for p in known),
                    "transliteration": " · ".join(p.get("roman") or "" for p in known),
                    "method": "word by word",
                    "note": "Word-by-word gloss from the word list, not a sentence translation.",
                }

        # 4. Honest miss
        return {
            "translation": "No translation for this phrase yet.",
            "transliteration": None,
            "method": "none",
            "note": "Not in the word list" + ("" if llm.available() else "; AI translation is not configured") + ".",
        }

    @staticmethod
    def detect_language(text: str) -> str:
        return "kannada_script" if is_kannada(text) else "latin"
