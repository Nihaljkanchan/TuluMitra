"""
Tulu dictionary — two sources combined:

1. The curated word list (data/tulu_lexicon.json): every Tulu word and
   phrase the app teaches, with its Latin-letter reading, English meanings
   and Kannada equivalents. This is what lets people search in English or
   Kannada.
2. The text corpus (the cleaned 73,872-sentence Tulu Wikipedia corpus): real word
   frequencies and real example sentences for ANY Kannada-script word,
   including the ~174,000 words that have no English meaning recorded.

Public functions keep the names of the original module:
    lookup(word)      -> full result for the Dictionary page
    search(keyword)   -> corpus sentences containing a keyword
    top_words(n)      -> most frequent corpus words
"""

import json
import logging
from collections import Counter, defaultdict

import config
from modules import llm
from modules.text_utils import (
    ascii_digits, distance, english_number, is_kannada, kannada_words, key,
    norm, read_number, sound,
)

log = logging.getLogger(__name__)

MAX_EXAMPLES_PER_WORD = 40  # sentence indices kept per word (memory bound)


class TuluDictionary:
    def __init__(self):
        self.entries = []
        self.sentences = []
        self.freq = Counter()
        self.index = defaultdict(list)  # word -> sentence indices
        self.corpus_name = None
        self._ai_cache = {}
        self._load_lexicon()
        self._load_corpus()

    # ------------------------------------------------------------------ load
    def reload_lexicon(self, feedback=None):
        """Re-read the word list (after an admin edit) and apply approved corrections."""
        self.entries = []
        self._load_lexicon()
        if feedback is not None:
            feedback.apply_to_entries(self.entries)
            self.add_sentences(feedback.sentences())

    def add_sentences(self, sentences):
        """Add corrected sentences to the corpus index (examples and frequency)."""
        extra = getattr(self, "_extra", None)
        if extra is None:
            extra = self._extra = set()
        for s in sentences:
            s = (s or "").strip()
            if not s or s in extra:
                continue
            extra.add(s)
            idx = len(self.sentences)
            self.sentences.append(s)
            for w in set(kannada_words(s)):
                self.freq[w] += 1
                if len(self.index[w]) < MAX_EXAMPLES_PER_WORD:
                    self.index[w].insert(0, idx)

    def _load_lexicon(self):
        try:
            data = json.loads(config.LEXICON_FILE.read_text(encoding="utf-8"))
            self.entries = data["entries"] if isinstance(data, dict) else data
        except json.JSONDecodeError as exc:
            log.error("Word list %s is not valid JSON (%s) — fix it or restore a backup", config.LEXICON_FILE, exc)
            self.entries = []
        except FileNotFoundError:
            log.warning("No lexicon at %s — English/Kannada search disabled", config.LEXICON_FILE)
        self.entries = [e for e in self.entries if isinstance(e, dict) and e.get("tulu")]
        for e in self.entries:
            e.setdefault("english_alts", [norm(e.get("english") or "")])
            e.setdefault("kannada", [])
            e["_key"] = key(e["tulu"])
            e["_roman"] = key(e.get("roman") or "")

    def _load_corpus(self):
        path = config.CORPUS_FILE if config.CORPUS_FILE.exists() else config.SAMPLE_CORPUS_FILE
        if not path.exists():
            log.warning("No corpus file found — frequencies and examples disabled")
            return
        self.corpus_name = path.name
        with path.open(encoding="utf-8") as f:
            for i, line in enumerate(f):
                s = line.strip()
                if not s:
                    continue
                idx = len(self.sentences)
                self.sentences.append(s)
                seen = set()
                for w in kannada_words(s):
                    self.freq[w] += 1
                    if w not in seen and len(self.index[w]) < MAX_EXAMPLES_PER_WORD:
                        self.index[w].append(idx)
                        seen.add(w)
        log.info("Corpus %s: %d sentences, %d unique words", path.name, len(self.sentences), len(self.freq))

    # --------------------------------------------------------------- corpus
    def frequency(self, word: str) -> int:
        return self.freq.get(key(word), 0) if is_kannada(word) else 0

    def examples(self, word: str, n: int = 5):
        """Short, readable sentences containing the word."""
        ids = self.index.get(key(word), [])
        picked = sorted((self.sentences[i] for i in ids), key=lambda s: (len(s) > 140, len(s)))
        return picked[:n]

    def search(self, keyword: str, n: int = 10):
        """Corpus sentences containing a keyword (slow path: full scan)."""
        k = (keyword or "").strip()
        if not k:
            return []
        out = [s for s in self.sentences if k in s]
        return sorted(out, key=len)[:n]

    def top_words(self, n: int = 50):
        return [{"word": w, "frequency": c} for w, c in self.freq.most_common(n)]

    def corpus_prefix(self, prefix: str, n: int = 6):
        """Other corpus words starting with this one — inflected forms, mostly."""
        p = key(prefix)
        if len(p) < 2:
            return []
        hits = [(w, c) for w, c in self.freq.items() if w.startswith(p) and w != p]
        hits.sort(key=lambda x: -x[1])
        return hits[:n]

    # -------------------------------------------------------------- lexicon
    def _score(self, e, q, qk, qs, is_kn, num):
        best = (0, "")

        def bump(score, how):
            nonlocal best
            if score > best[0]:
                best = (score, how)

        if e["_key"] == qk:
            bump(100, "Tulu")
        if not is_kn and e["_roman"] == qs:
            bump(96, "Tulu (Latin letters)")
        if e.get("number") and num == e["number"]:
            bump(98, "Number")
        alts = e["english_alts"]
        kns = e["kannada"]
        if not is_kn and q in alts:
            bump(94, "English meaning")
        if is_kn and any(key(k) == qk for k in kns):
            bump(94, "Kannada")

        if not e.get("number") and len(q) >= 2:
            spaced = lambda s: f" {norm(s)} "  # noqa: E731
            if is_kn:
                if f" {q} " in spaced(e["tulu"]):
                    bump(72, "Tulu")
                if any(f" {q} " in spaced(k) for k in kns):
                    bump(66, "Kannada")
                if e["_key"].startswith(qk):
                    bump(60, "Tulu")
                if any(key(k).startswith(qk) for k in kns):
                    bump(56, "Kannada")
                if qk in e["_key"]:
                    bump(42, "Tulu")
            else:
                roman = e.get("roman") or ""
                if f" {q} " in spaced(roman):
                    bump(72, "Tulu (Latin letters)")
                if any(f" {q} " in f" {a} " for a in alts):
                    bump(66, "English meaning")
                if len(q) >= 3 and e["_roman"].startswith(qs):
                    bump(58, "Tulu (Latin letters)")
                if len(q) >= 3 and any(a.startswith(q) for a in alts):
                    bump(55, "English meaning")
                if len(q) >= 3 and roman and sound(roman) == sound(q):
                    bump(50, "Sounds like")
                if len(q) >= 3 and any(sound(w) == sound(q) for w in roman.split()):
                    bump(46, "Sounds like")
                if len(q) >= 3 and qs in e["_roman"]:
                    bump(40, "Tulu (Latin letters)")
                lim = 2 if len(qs) >= 7 else 1 if len(qs) >= 4 else 0
                if lim and not best[0]:
                    if distance(e["_roman"], qs) <= lim:
                        bump(30, "Similar spelling")
                    elif any(distance(a.replace(" ", ""), qs) <= lim for a in alts):
                        bump(28, "Similar spelling")
        return best

    def _sources(self, e):
        out = []
        if e.get("category"):
            out.append(f"Lesson · {e['category'].replace('_', ' ').title()}")
        if e.get("phrasebook"):
            out.append("Phrasebook")
        if e.get("number"):
            out.append("Numbers")
        if self.frequency(e["tulu"]):
            out.append(f"Corpus ({self.corpus_name})")
        return out or ["Word list"]

    def _meanings(self, e):
        if e.get("number"):
            return [str(e["number"]), english_number(e["number"])]
        seen, out = set(), []
        for m in [e.get("english", "")] + e["english_alts"]:
            k = norm(m)
            if k and k not in seen:
                seen.add(k)
                out.append(m[:1].upper() + m[1:].rstrip("."))
        return out

    def _used_in(self, e):
        if e.get("number") or " " in e["tulu"]:
            return []
        w = norm(e["tulu"])
        return [
            {"tulu": x["tulu"], "roman": x.get("roman"), "english": x.get("english")}
            for x in self.entries
            if x is not e and not x.get("number") and f" {w} " in f" {norm(x['tulu'])} "
        ][:6]

    def _card(self, e, how):
        freq = self.frequency(e["tulu"]) if " " not in e["tulu"].strip() else 0
        return {
            "word": e["tulu"],
            "roman": e.get("roman"),
            "english": f"{e['number']} — {english_number(e['number'])}" if e.get("number") else e.get("english"),
            "meanings": self._meanings(e),
            "kannada": e["kannada"],
            "frequency": freq or None,
            "examples": self.examples(e["tulu"]) if freq else [],
            "usedIn": self._used_in(e),
            "sources": self._sources(e),
            "matchedBy": how,
            "composed": bool(e.get("composed")),
        }

    # --------------------------------------------------------------- lookup
    def lookup(self, word: str) -> dict:
        """Everything the Dictionary page shows for one search."""
        query = (word or "").strip()
        q = norm(ascii_digits(query))
        empty = {"word": query, "frequency": 0, "examples": [], "found": False, "card": None,
                 "related": [], "sentences": [], "total": 0, "fuzzy": False}
        if not q:
            return empty

        is_kn = is_kannada(q)
        qk, qs = key(q), key(q)
        num = read_number(q)

        scored = []
        for e in self.entries:
            score, how = self._score(e, q, qk, qs, is_kn, num)
            if score:
                scored.append((score, how, e))
        scored.sort(key=lambda t: (-t[0], len(t[2]["tulu"])))

        card = self._card(scored[0][2], scored[0][1]) if scored else None
        fuzzy = bool(scored) and scored[0][0] <= 30

        # A Kannada-script word with no curated entry can still be in the corpus.
        corpus_freq = self.frequency(q) if is_kn else 0
        if (not card or card["matchedBy"] not in ("Tulu", "Kannada")) and corpus_freq:
            card = {
                "word": qk, "roman": None, "english": None, "meanings": [], "kannada": [],
                "frequency": corpus_freq, "examples": self.examples(qk), "usedIn": [],
                "sources": [f"Corpus ({self.corpus_name})"], "matchedBy": "Tulu", "composed": False,
            }
            fuzzy = False

        # If static lexicon lacks meaning, or only weak fuzzy match, or missing English meaning:
        needs_ai = (
            not card
            or fuzzy
            or (card and not card.get("english") and not card.get("meanings"))
        )
        if needs_ai and llm.available():
            cache_key = norm(query)
            ai_data = self._ai_cache.get(cache_key)
            if ai_data is None:
                ai_data = llm.lookup_dictionary(query)
                if ai_data:
                    self._ai_cache[cache_key] = ai_data
                    if ai_data.get("tulu"):
                        self._ai_cache[norm(ai_data["tulu"])] = ai_data
                    if ai_data.get("roman"):
                        self._ai_cache[norm(ai_data["roman"])] = ai_data

            if ai_data and ai_data.get("tulu"):
                ai_tulu = ai_data["tulu"]
                ai_freq = self.frequency(ai_tulu) if is_kannada(ai_tulu) else 0
                ai_examples = self.examples(ai_tulu, 6) if ai_freq else []
                if not ai_examples and ai_data.get("examples"):
                    ai_examples = [ex for ex in ai_data["examples"] if ex]

                meanings = ai_data.get("meanings") or []
                if not meanings and ai_data.get("english"):
                    meanings = [ai_data["english"]]
                formatted_meanings = [m[:1].upper() + m[1:].rstrip(".") for m in meanings if m]

                sources = ["AI Dictionary"]
                if ai_freq:
                    sources.append(f"Corpus ({self.corpus_name})")
                elif card and card.get("sources"):
                    for s in card["sources"]:
                        if s not in sources:
                            sources.append(s)

                card = {
                    "word": ai_tulu,
                    "roman": ai_data.get("roman"),
                    "english": ai_data.get("english"),
                    "meanings": formatted_meanings,
                    "kannada": ai_data.get("kannada") or [],
                    "frequency": ai_freq or (card.get("frequency") if card else None),
                    "examples": ai_examples,
                    "usedIn": self._used_in({"tulu": ai_tulu}),
                    "sources": sources,
                    "matchedBy": "AI Dictionary",
                    "composed": False,
                }
                fuzzy = False

        related = [
            {"tulu": e["tulu"], "roman": e.get("roman"),
             "english": str(e["number"]) if e.get("number") else e.get("english"), "matchedBy": how}
            for _, how, e in scored[1:9]
            if not card or e["tulu"] != card["word"]
        ]
        # Inflected corpus forms (ನೀರ್ → ನೀರ್ದ, ನೀರ್‌ಡ್ …)
        if is_kn:
            for w, c in self.corpus_prefix(qk):
                if len(related) >= 10:
                    break
                related.append({"tulu": w, "roman": None, "english": f"{c:,} in corpus", "matchedBy": "Corpus form"})

        sentences = []
        if is_kn and card and not card["examples"]:
            sentences = [{"text": s, "word": qk} for s in self.examples(qk, 6)]

        return {
            "word": card["word"] if card else query,
            "frequency": (card or {}).get("frequency") or 0,
            "examples": (card or {}).get("examples") or [],
            "roman": (card or {}).get("roman"),
            "english": (card or {}).get("english"),
            "found": bool(card),
            "card": card,
            "fuzzy": fuzzy,
            "related": related,
            "sentences": sentences,
            "total": max(len(scored), 1 if card else 0),
        }

    # ---------------------------------------------------- used by other modules
    def find_english(self, phrase: str):
        q = norm(phrase)
        q = q[4:] if q.startswith("the ") else q
        return next((e for e in self.entries if q in e["english_alts"]), None)

    def find_tulu(self, text: str):
        k = key(text)
        if not k:
            return None
        for e in self.entries:
            if e["_key"] == k or (e["_roman"] and e["_roman"] == k):
                return e
        if is_kannada(text):
            return next((e for e in self.entries if any(key(x) == k for x in e["kannada"])), None)
        return None

    def number(self, n: int):
        return next((e for e in self.entries if e.get("number") == n), None)

    def stats(self):
        return {"lexicon_entries": len(self.entries), "corpus": self.corpus_name,
                "corpus_sentences": len(self.sentences), "corpus_unique_words": len(self.freq)}
