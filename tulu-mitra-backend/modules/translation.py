"""
Translation between English, Kannada and Tulu.

Order of attempts, most trustworthy first:
  1. The curated word list — an exact phrase match.
  2. A word-by-word gloss of the words that are in the list (labelled as
     such; it is not a sentence translation).
  3. A language model, if OPENAI_API_KEY or ANTHROPIC_API_KEY is set (labelled as AI translation).
  4. An honest "not available".

Note on Google: the Google Cloud Translation API does not list Tulu among
its supported languages, so it is not used here. If your original
translation.py used an unofficial Google Translate client, you can add it
as another step in `translate()` below — mark its results as such.
"""

import logging

from modules import llm
from modules.text_utils import is_kannada, norm

log = logging.getLogger(__name__)

TRANSLATE_SYSTEM = """You translate between English, Kannada and Tulu for Tulu Mitra.
Return only JSON: {"translation": "...", "roman": "..."}.
- When the target is Tulu, write it in Kannada script and give "roman" in simple Latin letters.
- When the target is English or Kannada, "roman" is "".
- Use common everyday Tulu. If unsure of a word, choose the plainest phrasing you are confident in."""


class Translator:
    def __init__(self, dictionary):
        self.d = dictionary

    def translate(self, text: str, source: str, target: str) -> dict:
        text = (text or "").strip()
        if not text:
            return {"translation": "", "transliteration": None, "method": "none"}

        # 1. Exact phrase
        entry = None
        if source == "english":
            entry = self.d.find_english(text)
        elif source in ("kannada", "tulu"):
            entry = self.d.find_tulu(text)
        if entry:
            if target == "tulu":
                return {"translation": entry["tulu"], "transliteration": entry.get("roman"), "method": "word list"}
            if target == "english" and entry.get("english"):
                return {"translation": entry["english"], "transliteration": None, "method": "word list"}
            if target == "kannada" and entry.get("kannada"):
                return {"translation": entry["kannada"][0], "transliteration": None, "method": "word list"}

        # 2. Word by word (English → Tulu only)
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

        # 3. LLM
        if llm.available():
            try:
                data = llm.ask_json(
                    f"Translate from {source} to {target}:\n{text}", system=TRANSLATE_SYSTEM
                )
                if data.get("translation"):
                    return {
                        "translation": data["translation"],
                        "transliteration": data.get("roman") or None,
                        "method": "ai",
                        "note": "AI translation — please verify with a Tulu speaker.",
                    }
            except llm.LLMError:
                pass

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
