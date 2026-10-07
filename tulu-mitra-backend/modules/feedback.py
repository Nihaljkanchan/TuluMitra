"""
Mistake reports from visitors, and the corrections an admin approves.

How it works
------------
1. A visitor presses "Report a mistake" under a reply, translation,
   dictionary result or lesson phrase, and types the correct Tulu (and/or
   English). POST /feedback stores it here as a *pending* report
   (storage/feedback.json).
2. The admin opens the Admin page, reads the report, can edit the
   suggestion, and approves or rejects it.
3. An approved correction is saved in data/corrections.json and used
   straight away, everywhere:
     • the same question / sentence / word gets the corrected answer
       (chat replies, translations, dictionary look-ups, quiz and lessons);
     • the wrong Tulu text is replaced by the corrected text wherever the
       backend would otherwise show it;
     • the corrected phrase joins the word list, so it can be searched in
       English, Tulu or Latin letters, and its sentence joins the corpus.
4. Every approved correction is also written to
   training/data/corrections.tsv, ready to be added to the data the next
   time the speech or language models are trained (see training/README.md).
   Approving does not retrain a neural network by itself — the correction
   is used at once through the data above, and becomes training data for
   the next training run.
"""

import csv
import threading
import time
import uuid

import config
from modules.store import read_json, write_json
from modules.text_utils import is_kannada, key, norm

FEEDBACK_FILE = config.STORAGE_DIR / "feedback.json"
CORRECTIONS_FILE = config.DATA_DIR / "corrections.json"
TRAINING_FILE = config.CORRECTIONS_EXPORT

KINDS = {"chat", "translation", "dictionary", "lesson", "other"}
MAX_REPORTS = 5000


def _clean(s, limit=600):
    return str(s or "").strip()[:limit]


def _triple(d):
    d = d if isinstance(d, dict) else {}
    return {"tulu": _clean(d.get("tulu")), "roman": _clean(d.get("roman"), 300), "english": _clean(d.get("english"))}


class Feedback:
    def __init__(self):
        self._lock = threading.Lock()
        self.reports = read_json(FEEDBACK_FILE, []) or []
        self.corrections = read_json(CORRECTIONS_FILE, []) or []

    # ------------------------------------------------------------- reports
    def submit(self, data: dict) -> dict:
        kind = data.get("kind") if data.get("kind") in KINDS else "other"
        suggested = _triple(data.get("suggested") or data)
        if not (suggested["tulu"] or suggested["english"] or _clean(data.get("note"))):
            raise ValueError("Please type the correct Tulu, the correct English, or a note.")
        report = {
            "id": uuid.uuid4().hex[:12],
            "created": int(time.time()),
            "status": "pending",
            "kind": kind,
            "page": _clean(data.get("page"), 40),
            "input": _clean(data.get("input")),            # what the visitor asked / searched / typed
            "direction": _clean(data.get("direction"), 40),  # e.g. "english-tulu" for translations
            "shown": _triple(data.get("shown")),           # what the site showed
            "suggested": suggested,                        # what the visitor says is right
            "note": _clean(data.get("note"), 1000),
            "reporter": _clean(data.get("reporter"), 60),
        }
        with self._lock:
            self.reports.insert(0, report)
            del self.reports[MAX_REPORTS:]
            write_json(FEEDBACK_FILE, self.reports, backup=False)
        return report

    def list(self, status=None):
        return [r for r in self.reports if not status or r["status"] == status]

    def counts(self):
        out = {"pending": 0, "approved": 0, "rejected": 0}
        for r in self.reports:
            out[r["status"]] = out.get(r["status"], 0) + 1
        out["corrections"] = len(self.corrections)
        return out

    def _find(self, rid):
        return next((r for r in self.reports if r["id"] == rid), None)

    def review(self, rid, action, final=None, note=None):
        with self._lock:
            r = self._find(rid)
            if not r:
                raise KeyError(rid)
            if action == "delete":
                self.reports.remove(r)
                write_json(FEEDBACK_FILE, self.reports, backup=False)
                return None
            if action == "reject":
                r["status"] = "rejected"
            elif action == "approve":
                fixed = _triple(final) if final else r["suggested"]
                if not (fixed["tulu"] or fixed["english"]):
                    raise ValueError("An approved correction needs the correct Tulu or English.")
                r["status"] = "approved"
                r["final"] = fixed
                self._add_correction(r, fixed)
            elif action == "reopen":
                r["status"] = "pending"
                self.corrections = [c for c in self.corrections if c.get("report") != rid]
                write_json(CORRECTIONS_FILE, self.corrections)
            else:
                raise ValueError("Unknown action")
            r["reviewed"] = int(time.time())
            if note is not None:
                r["admin_note"] = _clean(note, 1000)
            write_json(FEEDBACK_FILE, self.reports, backup=False)
            return r

    # --------------------------------------------------------- corrections
    def _add_correction(self, r, fixed):
        c = {
            "id": uuid.uuid4().hex[:12],
            "report": r["id"],
            "kind": r["kind"],
            "input": r["input"],
            "direction": r["direction"],
            "wrong": r["shown"],
            "tulu": fixed["tulu"],
            "roman": fixed["roman"],
            "english": fixed["english"],
            "approved": int(time.time()),
        }
        # One correction per question/word: a newer approval replaces the older.
        k = self._input_key(c)
        self.corrections = [x for x in self.corrections if not (k and self._input_key(x) == k)]
        self.corrections.append(c)
        write_json(CORRECTIONS_FILE, self.corrections)
        self._export_training()

    def set_corrections(self, items):
        """Admin edited the corrections list directly."""
        with self._lock:
            self.corrections = [x for x in items if isinstance(x, dict) and (x.get("tulu") or x.get("english"))]
            write_json(CORRECTIONS_FILE, self.corrections)
            self._export_training()

    def _export_training(self):
        TRAINING_FILE.parent.mkdir(parents=True, exist_ok=True)
        with TRAINING_FILE.open("w", encoding="utf-8", newline="") as f:
            w = csv.writer(f, delimiter="\t")
            w.writerow(["kind", "input", "wrong_tulu", "tulu", "roman", "english", "approved"])
            for c in self.corrections:
                w.writerow([c.get("kind"), c.get("input"), (c.get("wrong") or {}).get("tulu", ""),
                            c.get("tulu"), c.get("roman"), c.get("english"),
                            time.strftime("%Y-%m-%d", time.localtime(c.get("approved", 0)))])

    @staticmethod
    def _input_key(c):
        k = norm(c.get("input") or "")
        return f"{c.get('kind')}|{c.get('direction') or ''}|{k}" if k else ""

    # ------------------------------------------------------------- use them
    def answer_chat(self, text):
        """A corrected reply for exactly this question, if one was approved."""
        k = norm(text)
        for c in reversed(self.corrections):
            if c.get("kind") == "chat" and norm(c.get("input") or "") == k and c.get("tulu"):
                return {
                    "response": c["tulu"], "lang": "tulu", "transliteration": c.get("roman") or None,
                    "english": c.get("english") or None, "blocks": [], "suggestions": [],
                    "intent": "Corrected", "source": "correction",
                }
        return None

    def answer_translation(self, text, source, target):
        k = norm(text)
        direction = f"{source}-{target}"
        for c in reversed(self.corrections):
            if c.get("kind") != "translation" or norm(c.get("input") or "") != k:
                continue
            if c.get("direction") and c["direction"] != direction:
                continue
            out = c.get("tulu") if target == "tulu" else c.get("english") if target == "english" else None
            if out:
                return {"translation": out, "transliteration": c.get("roman") if target == "tulu" else None,
                        "method": "correction", "note": "Corrected by the Tulu Mitra team."}
        return None

    def replacements(self):
        """Wrong Tulu text → corrected Tulu text, longest first."""
        pairs = {}
        for c in self.corrections:
            wrong = ((c.get("wrong") or {}).get("tulu") or "").strip()
            right = (c.get("tulu") or "").strip()
            if right and is_kannada(wrong) and len(wrong) >= 2 and wrong != right:
                pairs[wrong] = right
        return sorted(pairs.items(), key=lambda p: -len(p[0]))

    def fix(self, obj):
        """Replace wrong Tulu inside any string, list or dict (a whole reply)."""
        pairs = self.replacements()
        if not pairs:
            return obj

        def walk(x):
            if isinstance(x, str):
                if not is_kannada(x):
                    return x
                for wrong, right in pairs:
                    if wrong in x:
                        x = x.replace(wrong, right)
                return x
            if isinstance(x, list):
                return [walk(v) for v in x]
            if isinstance(x, dict):
                return {k: (v if k in ("memory",) else walk(v)) for k, v in x.items()}
            return x

        return walk(obj)

    def apply_to_entries(self, entries):
        """Update word-list entries in place, and add new ones.

        A correction whose wrong (or input) Tulu matches an entry updates
        that entry; one with both Tulu and English that matches nothing is
        added as a new entry, so it can be searched and translated."""
        by_key = {e.get("_key") or key(e["tulu"]): e for e in entries}
        by_en = {norm(e.get("english") or ""): e for e in entries if e.get("english")}
        for c in self.corrections:
            tulu, english = c.get("tulu"), c.get("english")
            wrong = (c.get("wrong") or {}).get("tulu") or ""
            target = None
            for probe in (wrong, c.get("input") or "", tulu or ""):
                if probe and is_kannada(probe) and key(probe) in by_key:
                    target = by_key[key(probe)]
                    break
            if target is None and not is_kannada(c.get("input") or "") and norm(c.get("input") or "") in by_en \
                    and c.get("kind") in ("dictionary", "translation"):
                target = by_en[norm(c["input"])]
            if target is not None:
                if tulu:
                    target["tulu"] = tulu
                    target["_key"] = key(tulu)
                if c.get("roman"):
                    target["roman"] = c["roman"]
                    target["_roman"] = key(c["roman"])
                if english:
                    target["english"] = english
                    alts = target.setdefault("english_alts", [])
                    if norm(english) not in alts:
                        alts.insert(0, norm(english))
                target["corrected"] = True
            elif tulu and is_kannada(tulu) and english:
                en_input = [] if is_kannada(c.get("input") or "") else [norm(c.get("input") or "")]
                e = {"tulu": tulu, "roman": c.get("roman") or "", "english": english,
                     "english_alts": [a for a in dict.fromkeys([norm(english), *en_input]) if a],
                     "kannada": [], "number": None, "composed": False, "category": "corrections",
                     "phrasebook": False, "corrected": True, "_key": key(tulu), "_roman": key(c.get("roman") or "")}
                entries.append(e)
                by_key[e["_key"]] = e
        return entries

    def apply_to_lessons(self, categories):
        pairs = dict(self.replacements())
        by_wrong = {}
        for c in self.corrections:
            w = ((c.get("wrong") or {}).get("tulu") or "").strip()
            if w:
                by_wrong[w] = c
        for cat in categories:
            for it in cat.get("items", []):
                c = by_wrong.get(it.get("tulu", "").strip())
                if c:
                    if c.get("tulu"):
                        it["tulu"] = c["tulu"]
                    if c.get("roman"):
                        it["roman"] = c["roman"]
                    if c.get("english"):
                        it["english"] = c["english"]
                    it["corrected"] = True
                else:
                    for wrong, right in pairs.items():
                        if wrong in it.get("tulu", ""):
                            it["tulu"] = it["tulu"].replace(wrong, right)
        return categories

    def sentences(self):
        """Corrected Tulu sentences, added to the corpus for examples."""
        return [c["tulu"] for c in self.corrections if c.get("tulu") and is_kannada(c["tulu"])]
