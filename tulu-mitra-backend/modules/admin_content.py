"""
The data files the Admin page can edit, and how each is checked before it
is saved. Every save keeps a backup (storage/backups/), and the running
server reloads the data at once — no restart needed.

    lexicon      data/tulu_lexicon.json   dictionary + translation word list
    lessons      data/tulu_lessons.json   Learn page lessons and quizzes
    greetings    data/site_content.json   welcome-screen greetings
    corrections  data/corrections.json    approved corrections from visitors
"""

import time

import config
from modules.store import read_json, write_json
from modules.text_utils import norm

SITE_FILE = config.DATA_DIR / "site_content.json"

FILES = {
    "lexicon": config.LEXICON_FILE,
    "lessons": config.LESSONS_FILE,
    "greetings": SITE_FILE,
    "corrections": config.DATA_DIR / "corrections.json",
}


class Invalid(ValueError):
    pass


def _s(x, limit=600):
    return str(x or "").strip()[:limit]


# ---------------------------------------------------------------- read
def read(name):
    path = FILES[name]
    data = read_json(path, None)
    if name == "lexicon":
        entries = data["entries"] if isinstance(data, dict) else (data or [])
        return {"entries": [{k: v for k, v in e.items() if not k.startswith("_")} for e in entries]}
    if name == "lessons":
        return data if isinstance(data, dict) and "categories" in data else {"categories": []}
    if name == "greetings":
        return (data or {}).get("greetings") or {}
    if name == "corrections":
        return {"items": data or []}
    raise KeyError(name)


def greetings():
    return read("greetings")


# ------------------------------------------------------------ validate
def _lexicon(data):
    rows = data.get("entries") if isinstance(data, dict) else data
    if not isinstance(rows, list):
        raise Invalid("Expected a list of word-list entries.")
    out, seen = [], set()
    for i, e in enumerate(rows, 1):
        if not isinstance(e, dict):
            raise Invalid(f"Entry {i} is not an object.")
        tulu = _s(e.get("tulu"), 300)
        if not tulu:
            continue  # blank rows are simply dropped
        english = _s(e.get("english"), 300)
        alts = e.get("english_alts")
        if isinstance(alts, str):
            alts = [a for a in alts.split(";")]
        alts = [norm(a) for a in (alts or []) if norm(a)]
        if english and norm(english) not in alts:
            alts.insert(0, norm(english))
        kannada = e.get("kannada")
        if isinstance(kannada, str):
            kannada = kannada.split(";")
        kannada = [_s(k, 200) for k in (kannada or []) if _s(k)]
        number = e.get("number")
        try:
            number = int(number) if number not in (None, "") else None
        except (TypeError, ValueError):
            raise Invalid(f"Entry {i} ({tulu}): number must be a whole number or empty.")
        k = (tulu, number)
        if k in seen:
            raise Invalid(f"“{tulu}” appears twice in the word list.")
        seen.add(k)
        out.append({
            "tulu": tulu, "roman": _s(e.get("roman"), 300), "english": english, "english_alts": alts,
            "kannada": kannada, "number": number, "composed": bool(e.get("composed")),
            "category": _s(e.get("category"), 60) or None, "phrasebook": bool(e.get("phrasebook")),
        })
    return {"about": "Tulu Mitra word list — edited on the Admin page.", "updated": time.strftime("%Y-%m-%d %H:%M"),
            "count": len(out), "entries": out}


def _lessons(data):
    cats = data.get("categories") if isinstance(data, dict) else data
    if not isinstance(cats, list):
        raise Invalid("Expected a list of lesson categories.")
    out, ids = [], set()
    for i, c in enumerate(cats, 1):
        label = _s(c.get("label"), 80)
        cid = _s(c.get("id"), 60) or norm(label).replace(" ", "_")
        if not cid:
            raise Invalid(f"Category {i} needs a name.")
        if cid in ids:
            raise Invalid(f"Two categories are called “{cid}”.")
        ids.add(cid)
        items = []
        for it in c.get("items") or []:
            tulu = _s(it.get("tulu"), 300)
            if tulu:
                items.append({"tulu": tulu, "roman": _s(it.get("roman"), 300), "english": _s(it.get("english"), 300)})
        out.append({"id": cid, "label": label or cid, "kn": _s(c.get("kn"), 80) or None,
                    "blurb": _s(c.get("blurb"), 400) or None, "items": items})
    return {"categories": out}


def _greetings(data):
    if not isinstance(data, dict):
        raise Invalid("Expected the greetings object.")
    qs = []
    for q in data.get("questions") or []:
        tulu = _s(q.get("tulu"), 200)
        if not tulu:
            continue
        when = q.get("when") or []
        if isinstance(when, str):
            when = [w.strip() for w in when.split(",") if w.strip()]
        visit = _s(q.get("visit"), 20)
        if visit not in ("", "first", "returning"):
            raise Invalid(f"“{tulu}”: visit must be empty, first or returning.")
        qs.append({"tulu": tulu, "roman": _s(q.get("roman"), 200), "english": _s(q.get("english"), 200),
                   "when": when, "visit": visit})
    if not qs:
        raise Invalid("Keep at least one greeting question.")
    tod = []
    for t in data.get("time_of_day") or []:
        try:
            tod.append({"from": int(t["from"]), "to": int(t["to"]), "key": _s(t.get("key"), 20),
                        "english": _s(t.get("english"), 60)})
        except (KeyError, TypeError, ValueError):
            raise Invalid("Each time of day needs whole-number from / to hours.")
    head = data.get("headline") or {}
    lines = data.get("visit_lines") or {}
    try:
        away = int(data.get("long_away_days", 3))
    except (TypeError, ValueError):
        raise Invalid("long_away_days must be a whole number.")
    return {
        "headline": {"tulu": _s(head.get("tulu"), 80) or "ಸೊಲ್ಮೆಲು", "roman": _s(head.get("roman"), 80) or "solmelu",
                     "english": _s(head.get("english"), 80) or "Greetings"},
        "time_of_day": tod,
        "questions": qs,
        "visit_lines": {k: _s(lines.get(k), 120) for k in ("first", "returning", "long_away") if lines.get(k)},
        "long_away_days": away,
    }


def save(name, data):
    if name == "lexicon":
        write_json(FILES[name], _lexicon(data))
    elif name == "lessons":
        write_json(FILES[name], _lessons(data))
    elif name == "greetings":
        site = read_json(SITE_FILE, {}) or {}
        site["greetings"] = _greetings(data)
        write_json(SITE_FILE, site)
    else:
        raise KeyError(name)
