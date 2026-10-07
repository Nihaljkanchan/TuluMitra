"""
Lessons and quizzes.

Lessons come from data/tulu_lessons.json. Two shapes are accepted, so your
own 8-category tulu_lessons.json can be dropped in unchanged if it uses
either of them:

    {"categories": [{"id", "label", "items": [{"tulu", "roman", "english"}]}]}
    {"greetings": [{"tulu"|"sentence", "english"|"meaning", "roman"?}], ...}

Quizzes are stateless on the server: the question and score travel in the
`memory` object the frontend sends back with each message.
"""

import json
import logging
import random

import config
from modules.text_utils import distance, key

log = logging.getLogger(__name__)


def _normalise(raw):
    if isinstance(raw, dict) and "categories" in raw:
        cats = raw["categories"]
    elif isinstance(raw, dict):
        cats = [{"id": k, "label": k.replace("_", " ").title(), "items": v} for k, v in raw.items()]
    else:
        cats = raw
    out = []
    for c in cats:
        items = []
        for it in c.get("items", []):
            tulu = it.get("tulu") or it.get("sentence") or it.get("text")
            english = it.get("english") or it.get("meaning") or it.get("translation")
            if tulu:
                items.append({"tulu": tulu, "roman": it.get("roman") or it.get("transliteration"), "english": english})
        out.append({"id": c.get("id") or key(c.get("label", "")), "label": c.get("label") or c.get("id"),
                    "kn": c.get("kn"), "blurb": c.get("blurb"), "items": items})
    return out


class Teacher:
    def __init__(self, dictionary, feedback=None):
        self.dictionary = dictionary
        self.reload(feedback)

    def reload(self, feedback=None):
        """Re-read the lessons (after an admin edit) and apply approved corrections."""
        try:
            self.categories = _normalise(json.loads(config.LESSONS_FILE.read_text(encoding="utf-8")))
        except FileNotFoundError:
            log.warning("No lessons file at %s", config.LESSONS_FILE)
            self.categories = []
        except (json.JSONDecodeError, AttributeError, TypeError) as exc:
            log.error("Lessons file %s is not valid (%s) — fix it or restore a backup", config.LESSONS_FILE, exc)
            self.categories = []
        if feedback is not None:
            feedback.apply_to_lessons(self.categories)

    # ---------------------------------------------------------------- lessons
    def category_index(self, text: str):
        t = (text or "").lower()
        for i, c in enumerate(self.categories):
            if c["id"].lower() in t or (c["label"] or "").lower() in t:
                return i
        aliases = {"greeting": "greetings", "hello": "greetings", "eat": "food", "kitchen": "food",
                   "phrase": "daily", "everyday": "daily", "command": "commands"}
        for word, cid in aliases.items():
            if word in t:
                return next((i for i, c in enumerate(self.categories) if c["id"] == cid), None)
        return None

    def lesson(self, index: int):
        return self.categories[index % len(self.categories)] if self.categories else None

    def as_json(self):
        return {"categories": self.categories}

    # ------------------------------------------------------------------ quiz
    def _pool(self, kind, lesson):
        if kind == "numbers":
            return [e for e in self.dictionary.entries if e.get("number") and e["number"] <= 20]
        if lesson is not None and self.categories:
            return [i for i in self.lesson(lesson)["items"] if i.get("roman") and "name is" not in (i.get("english") or "").lower()]
        return [e for e in self.dictionary.entries
                if not e.get("number") and e.get("roman") and e.get("english") and len(e["tulu"]) < 26
                and "name is" not in e["english"].lower()]

    def question(self, kind="words", lesson=None, previous=None):
        pool = [e for e in self._pool(kind, lesson) if e["tulu"] != previous]
        if len(pool) < 3:
            pool = self._pool("words", None)
        answer = random.choice(pool)
        wrong = random.sample([e for e in pool if e["roman"] != answer["roman"]], k=min(2, len(pool) - 1))
        options = [e["roman"] for e in wrong] + [answer["roman"]]
        random.shuffle(options)
        en = (answer.get("english") or "").rstrip(".")
        phrase = en if en.startswith("I ") else en[:1].lower() + en[1:]
        prompt = (f"How do you say **{answer['number']}** in Tulu?" if answer.get("number")
                  else f"How do you say **“{phrase}”** in Tulu?")
        return {"answer": {"tulu": answer["tulu"], "roman": answer["roman"], "english": answer.get("english")},
                "prompt": prompt, "options": options, "kind": kind, "lesson": lesson}

    @staticmethod
    def is_correct(guess: str, answer: dict) -> bool:
        g, target = key(guess), key(answer["roman"])
        if g == target or g == key(answer["tulu"]):
            return True
        return len(target) >= 4 and distance(g, target) <= (2 if len(target) >= 9 else 1)
