"""
Conversation — turns one user message into one Tulu Mitra reply.

    respond(text, language, history, memory) -> reply dict

Flow: detect intent → answer from the project's own data where possible
(greetings, translations, meanings, numbers, lessons, quizzes, Tulu Lipi)
→ otherwise ask Claude if configured → otherwise say plainly that the
answer isn't known. Nothing here invents Tulu.

The reply dict matches what the frontend renders:
    response        main line (Tulu in Kannada script, or English)
    lang            "tulu" | "english" — which language `response` is in
    transliteration Latin-letter reading of a Tulu `response`
    english         English meaning of a Tulu `response`
    blocks          extra content: text / bullets / note / phrases / word / lipi
    suggestions     follow-up chips
    intent          topic label shown under the reply
    memory          small per-chat state (name, quiz, lesson); the frontend
                    stores it and sends it back with the next message
    source          "rules" | "llm" | "none"
"""

import json
import logging
import random
import re

import config
from modules import llm
from modules.intent_detector import GREET, detect
from modules.text_utils import english_number, fold, is_kannada, norm, read_number

log = logging.getLogger(__name__)


def tulu(text, roman, english, **extra):
    return {"response": text, "lang": "tulu", "transliteration": roman, "english": english, **extra}


def eng(text, **extra):
    return {"response": text, "lang": "english", **extra}


def item(e):
    en = f"{e['number']} ({english_number(e['number'])})" if e.get("number") else e.get("english")
    return {"tulu": e["tulu"], "roman": e.get("roman"), "english": en,
            "note": "composed" if e.get("composed") else None}


FACTS = {
    "region": (r"(where|region|spoken|district|state|tulu ?nadu)",
               "Tulu is spoken mainly in **Dakshina Kannada** and **Udupi** districts of Karnataka and **Kasaragod** district of Kerala — together called Tulu Nadu — with large communities in Mumbai, Bengaluru and the Gulf."),
    "speakers": (r"(how many|speakers|population|census)",
                 "The **2011 Census of India** counted about **18.5 lakh** people reporting Tulu as their mother tongue."),
    "script": (r"(script|written|alphabet)",
               "Tulu is mostly written in the **Kannada script** today. Its own historic script, **Tulu Lipi** (Tulu-Tigalari), was encoded in Unicode 16.0 in 2024."),
    "family": (r"(dravidian|family|related|origin|history)",
               "Tulu is a **Dravidian** language of the southern branch. It separated early from its relatives, so it is not mutually intelligible with Kannada despite sharing a script."),
    "culture": (r"(culture|festival|yakshagana|bhuta|bhoota|kola|kambala|tradition)",
                "Tulu Nadu is known for **Yakshagana** dance-drama, **Bhuta Kola** ritual performance (in Tulu), **Kambala** buffalo racing, and a coastal cuisine of rice, fish, coconut and jackfruit."),
    "status": (r"(official|schedule|recogni|status)",
               "Tulu is **not** among the 22 languages of the Eighth Schedule of India's Constitution; there is a long-running campaign to add it."),
    "overview": (r"(what is|about|tell me|language)",
                 "**Tulu** (ತುಳು) is a Dravidian language spoken along the south-western coast of India, in the region called **Tulu Nadu**, with a rich oral tradition of folk epics (*paddanas*), theatre and ritual."),
}

STARTERS = ["Teach me greetings", "How do you say water in Tulu?", "Count from 1 to 10",
            "Quiz me", "What is Tulu Lipi?", "What is Tulu?"]


def starters(k=3):
    return random.sample(STARTERS, k)


class Conversation:
    def __init__(self, dictionary, teacher, translator):
        self.d = dictionary
        self.teacher = teacher
        self.translator = translator
        try:
            self.lipi = json.loads(config.LIPI_FILE.read_text(encoding="utf-8"))
        except FileNotFoundError:
            self.lipi = {"groups": []}

    # ================================================================ entry
    def respond(self, text, language="english", history=None, memory=None):
        memory = dict(memory or {})
        reply = self._route((text or "").strip(), language, history or [], memory)
        new_memory = {**memory, **reply.pop("memory", {})}
        if memory.get("quiz") and reply.get("intent") != "Quiz":
            new_memory["quiz"] = None
        reply.setdefault("blocks", [])
        reply.setdefault("suggestions", [])
        reply.setdefault("source", "rules")
        reply["memory"] = new_memory
        return reply

    # ================================================================ route
    def _route(self, text, language, history, mem):
        t = norm(text)
        if not t:
            return eng("Say something and I'll reply in Tulu.", intent="Chat", suggestions=starters())

        # A running quiz takes the next answer unless it's plainly a new question.
        new_question = re.match(r"^(what|how|who|why|where|tell|teach|translate|show|count|define|help)\b", t) and len(t.split()) > 2
        if mem.get("quiz") and not new_question:
            return self._quiz_turn(text, mem)

        # "hi, how do you say …" — drop the greeting and carry on.
        if GREET.search(t):
            rest = GREET.sub("", t).strip()
            if len(rest.split()) < 2:
                return self._greeting(mem)
            t, text = rest, rest

        intent = detect(t)["intent"]
        handler = {
            "quiz": self._quiz_start, "numbers": self._numbers, "lipi": self._lipi,
            "teaching": self._teaching, "dictionary": self._meaning, "translation": self._translate,
            "about": self._about, "help": self._help, "farewell": self._farewell,
            "thanks": self._thanks, "name": self._name, "greeting": lambda *_: self._greeting(mem),
        }.get(intent)
        if handler:
            r = handler(text, t, mem)
            if r:
                return r

        if re.search(r"(who are you|your name|introduce yourself|ನಿಮ್ಮ ಹೆಸರೇನು)", t):
            return tulu("ಎನ್ನ ಪುದರ್ ತುಳು ಮಿತ್ರ.", "enna pudar Tulu Mitra.", "My name is Tulu Mitra.",
                        blocks=[{"type": "text", "text": "*Mitra* means friend — I help you speak, learn and translate Tulu."}],
                        suggestions=["What can you do?", "Who made you?", "My name is Abhishek"], intent="Greetings")
        if re.search(r"\btulu\b|ತುಳು|yakshagana|kambala|bhuta kola", t):
            for pattern, answer in FACTS.values():
                if re.search(pattern, t):
                    return eng(answer, suggestions=["Where is Tulu spoken?", "How many people speak Tulu?", "Teach me greetings"],
                               intent="About Tulu")
        if t == "another word":
            e = random.choice([x for x in self.d.entries if not x.get("number") and " " not in x["tulu"].strip()])
            return self._meaning(e["tulu"], f"meaning of {e['tulu']}", mem)
        if re.match(r"^(ok|okay|cool|nice|great|good|alright|yes|sure|fine)$", t):
            return tulu("ಸರಿ!", "sari!", "Alright!", suggestions=starters(), intent="Chat")

        # A phrase from the word list said to us — reply to it.
        known = self.d.find_tulu(text) or self.d.find_english(t)
        if known:
            r = self._conversational(known, mem)
            if r:
                return r

        return self._open_question(text, history, mem)

    # ============================================================ handlers
    def _greeting(self, mem):
        name = f" {mem['name']}" if mem.get("name") else ""
        v = random.choice([
            ("ಸೊಲ್ಮೆಲು! ಎಂಕ್ ಎಡ್ಡೆ ಉಂಡು. ಈರೆಗ್ ಎಂಚ ಉಂಡು?", "solmelu! enk edde undu. eereg encha undu?", f"Greetings{name}! I am well. How are you?"),
            ("ಸೊಲ್ಮೆಲು! ಎಂಚ ಉಲ್ಲರ್?", "solmelu! encha ullar?", f"Greetings{name}! How are you?"),
        ])
        return tulu(*v, blocks=[{"type": "text", "text": "**ಸೊಲ್ಮೆಲು** (solmelu) is the everyday Tulu greeting."}],
                    suggestions=["I am well", "What can you do?", "Teach me greetings"], intent="Greetings")

    def _farewell(self, text, t, mem):
        return tulu("ಬೊಕ್ಕ ತಿಕ್ಕುಗ!", "bokka tikkuga!", "See you again!", suggestions=["Quiz me"], intent="Greetings")

    def _thanks(self, text, t, mem):
        return eng("You're welcome! What shall we learn next?", suggestions=starters(), intent="Chat")

    def _name(self, text, t, mem):
        m = re.match(r"^(?:my name is|call me|ಎನ್ನ ಪುದರ್|ನನ್ನ ಹೆಸರು)\s+(.{1,30})$", t)
        if not m:
            return None
        name = m.group(1).strip().title()
        return eng(f"Nice to meet you, **{name}**! Here's how you'd introduce yourself in Tulu:",
                   blocks=[{"type": "phrases", "items": [{"tulu": f"ಎನ್ನ ಪುದರ್ {name}", "roman": f"enna pudar {name}", "english": f"My name is {name}."}]}],
                   suggestions=["ಈರೆನ ಪುದರ್ ದಾದ?", "Teach me greetings", "Quiz me"], intent="Greetings",
                   memory={"name": name})

    def _help(self, text, t, mem):
        return eng("Here's what I can do — ask in English, Kannada or Tulu, by text or voice:", blocks=[{"type": "bullets", "items": [
            "**Translate** — “How do you say *water* in Tulu?”",
            "**Word meanings** — “What does ನೀರ್ mean?”, with corpus examples",
            "**Numbers** — any number 1–100, or “count from 1 to 20”",
            "**Lessons** and **quizzes** with a running score",
            "**Tulu Lipi** — Tulu's own script, letter by letter",
            "**Open questions**" + (" — answered by the language model" if llm.available() else " — needs the language model to be configured"),
        ]}], suggestions=["Quiz me", "Teach me greetings", "What is Tulu?"], intent="Help")

    def _about(self, text, t, mem):
        return eng("I'm **Tulu Mitra**, a major project by **Abhishek Nayak** and **Nihal**, Department of AI & ML, **Canara Engineering College**.",
                   blocks=[{"type": "bullets", "items": [
                       "**Speech in** — Whisper, fine-tuned on Tulu recordings with LoRA (/asr)",
                       "**Understanding** — intent detection, the Tulu word list and a 73,872-sentence Tulu corpus (/chat)",
                       "**Speech out** — text-to-speech, optionally in your own voice (/tts)",
                   ]}], suggestions=["What can you do?", "Quiz me"], intent="About the project")

    # --------------------------------------------------------- numbers
    def _numbers(self, text, t, mem):
        m = re.search(r"count(?:ing)?(?: numbers)?(?: in tulu)?(?: from (\d+))?(?: (?:to|till|until|up to|upto) (\d+))?", t)
        if m:
            start = int(m.group(1) or 1)
            end = int(m.group(2) or (start + 9))
            return self._count(start, end)
        m = re.search(r"(\d+|[a-z]+(?: [a-z]+)?)", re.sub(r"^(what is|whats|say|number)\s+", "", t).replace(" in tulu", ""))
        n = read_number(m.group(1)) if m else None
        if n is None and re.search(r"numbers?", t):
            return self._count(1, 10)
        if n is None:
            return None
        e = self.d.number(n)
        if not e:
            return eng(f"I know the Tulu numbers 1 to 100 — {n} is outside that range.", intent="Numbers")
        notes = [{"type": "note", "text": "Written as tens word + unit word; the spoken, fused form varies by region."}] if e.get("composed") else []
        return tulu(e["tulu"], e.get("roman"), f"{n} — {english_number(n)}", blocks=notes,
                    suggestions=[f"What is {min(100, n + 1)} in Tulu?", f"Count from {n} to {min(100, n + 9)}", "Quiz me on numbers"],
                    intent="Numbers")

    def _count(self, start, end):
        start, end = max(1, min(100, start)), max(1, min(100, end))
        end = min(max(start, end), start + 19)
        items = [{**item(self.d.number(n)), "english": str(n)} for n in range(start, end + 1) if self.d.number(n)]
        sugg = [f"Count from {end + 1} to {min(100, end + 10)}"] if end < 100 else []
        return eng(f"Counting from {start} to {end} in Tulu:", blocks=[{"type": "phrases", "items": items, "numbered": True}],
                   suggestions=sugg + ["Quiz me on numbers"], intent="Numbers")

    # --------------------------------------------------------- lessons
    def _teaching(self, text, t, mem):
        cats = self.teacher.categories
        if not cats:
            return None
        if re.match(r"^(next|next lesson|more|continue)", t) and mem.get("lesson") is not None:
            idx = mem["lesson"] + 1
        else:
            idx = self.teacher.category_index(t)
            if idx is None:
                idx = (mem["lesson"] + 1) if mem.get("lesson") is not None else 0
        c = self.teacher.lesson(idx)
        nxt = self.teacher.lesson(idx + 1)
        return eng(f"**Lesson: {c['label']}**. Play each one and say it back out loud.",
                   blocks=[{"type": "phrases", "items": [{**i, "note": None} for i in c["items"]]}],
                   suggestions=["Quiz me on this", f"Next lesson: {nxt['label']}"], intent=f"Lesson · {c['label']}",
                   memory={"lesson": idx % len(cats)})

    # ------------------------------------------------------------ quiz
    def _quiz_start(self, text, t, mem):
        kind = "numbers" if "number" in t else "words"
        lesson = self.teacher.category_index(t)
        if lesson is None and re.search(r"\b(this|these|lesson)\b", t) and mem.get("lesson") is not None:
            lesson = mem["lesson"]
        q = self.teacher.question(kind, lesson)
        return eng(f"Quiz time! Answer in Latin letters or Kannada script, or tap an option.\n\n{q['prompt']}",
                   suggestions=q["options"] + ["Hint", "Skip"], intent="Quiz",
                   memory={"quiz": {**q, "asked": 1, "score": 0}})

    def _quiz_turn(self, text, mem):
        quiz = mem["quiz"]
        ans = quiz["answer"]
        t = norm(text)
        if re.match(r"^(stop|quit|end|exit|finish)( quiz)?$", t) or t == "stop quiz":
            done = quiz["asked"] - 1
            return eng(f"Quiz finished — you scored **{quiz['score']} out of {done}**.",
                       suggestions=["Quiz me again", "Teach me food words"], intent="Quiz", memory={"quiz": None})
        if t in ("hint", "clue"):
            return eng(f"Hint: it starts with **{ans['roman'][:max(2, len(ans['roman']) // 3)]}…**",
                       suggestions=["Skip", "Stop quiz"], intent="Quiz", memory={"quiz": quiz})
        skipped = t in ("skip", "pass", "next", "i dont know", "dont know")
        correct = not skipped and self.teacher.is_correct(text, ans)
        score = quiz["score"] + int(correct)
        nxt = self.teacher.question(quiz["kind"], quiz.get("lesson"), previous=ans["tulu"])
        reveal = {"type": "phrases", "items": [{"tulu": ans["tulu"], "roman": ans["roman"], "english": ans["english"]}]}
        follow = {"type": "text", "text": f"**Next:** {nxt['prompt']}"}
        base = dict(blocks=[reveal, follow], suggestions=nxt["options"] + ["Hint", "Stop quiz"], intent="Quiz",
                    memory={"quiz": {**nxt, "asked": quiz["asked"] + 1, "score": score}})
        if correct:
            return tulu("ಸರಿ!", "sari!", f"Correct! That's {score}/{quiz['asked']}.", **base)
        msg = (f"The answer is **{ans['tulu']}** ({ans['roman']})." if skipped
               else f"Not quite — it's **{ans['tulu']}** ({ans['roman']}). Score: {score}/{quiz['asked']}.")
        return eng(msg, **base)

    # --------------------------------------------------------- meaning
    def _meaning(self, text, t, mem):
        m = (re.match(r"^(?:what does|what do)\s+(.+?)\s+means?$", t)
             or re.match(r"^(?:what is |whats )?(?:the )?meaning of\s+(.+)$", t)
             or re.match(r"^(?:define)\s+(.+)$", t)
             or re.match(r"^(.+?)\s+meaning$", t))
        word = m.group(1) if m else re.sub(r"ಅರ್ಥ(ವೇನು|ಏನು)?|ಏನು|ದಾದ", "", t).strip()
        if not word:
            return None
        r = self.d.lookup(word)
        card = r["card"]
        if not card:
            return eng(f"I couldn't find **{word}** in the word list or the corpus.",
                       suggestions=["What does ನೀರ್ mean?", "Teach me food words"], intent="Word meaning")
        block = {"type": "word", "word": card["word"], "roman": card.get("roman"), "english": card.get("english") or "",
                 "frequency": card.get("frequency"), "examples": card.get("examples") or []}
        if card.get("english"):
            lead = f"**{card['word']}**" + (f" ({card['roman']})" if card.get("roman") else "") + f" means **{card['english'].lower()}**."
        else:
            lead = f"**{card['word']}** appears in the corpus, but its English meaning isn't in the word list yet."
        return eng(lead, blocks=[block], suggestions=["Quiz me", "Another word"], intent="Word meaning")

    # ----------------------------------------------------- translation
    def _translate(self, text, t, mem):
        m = (re.match(r"^(?:how (?:do|would|can|should) (?:you|i|we) say|how to say)\s+(.+?)(?:\s+(?:in|into) tulu)?$", t)
             or re.match(r"^(?:translate)\s+(.+?)(?:\s+(?:in|into|to) tulu)?$", t)
             or re.match(r"^(?:what(?: is|s) )?(?:the )?tulu (?:word )?for\s+(.+)$", t)
             or re.match(r"^(?:what(?: is|s)\s+)?(.+?)\s+in tulu$", t))
        phrase = m.group(1) if m else re.sub(r"ತುಳುವಿನಲ್ಲಿ.*|ತುಳುವಲ್ಲಿ.*", "", t).strip()
        if not phrase:
            return None
        if phrase in ("something else", "something"):
            return eng("Sure — type any English word or phrase, like “how do you say fish in Tulu?”",
                       suggestions=["How do you say fish in Tulu?", "Translate I am hungry"], intent="Translation")
        n = read_number(phrase)
        if n:
            return self._numbers(f"{n}", f"{n}", mem)
        source = "kannada" if is_kannada(phrase) else "english"
        r = self.translator.translate(phrase, source, "tulu")
        if r["method"] == "none":
            return eng(f"I don't have a Tulu translation for “{phrase}” yet.",
                       blocks=[{"type": "note", "text": r.get("note", "")}],
                       suggestions=["How do you say water in Tulu?", "Teach me daily phrases"], intent="Translation")
        blocks = [{"type": "note", "text": r["note"]}] if r.get("note") else []
        return tulu(r["translation"], r.get("transliteration"), phrase[:1].upper() + phrase[1:], blocks=blocks,
                    suggestions=["Quiz me", "Translate something else"], intent="Translation",
                    source="llm" if r["method"] == "ai" else "rules")

    # ------------------------------------------------------------ lipi
    def _lipi(self, text, t, mem):
        groups = self.lipi.get("groups", [])
        letters = [dict(l, cp=l.get("codepoint")) for g in groups for l in g["letters"]]
        stop = {"a", "i", "in", "is", "the", "how", "do", "you", "write", "tulu", "lipi", "letter", "what", "show", "me", "tigalari", "script"}
        tokens = [w for w in t.split() if w not in stop]
        hits = [l for l in letters if any(fold(l["roman"]) == fold(w) for w in tokens)] if "varga" not in t else []
        if hits:
            return eng(f"Here is **{hits[0]['roman']}** in Tulu Lipi — the same sound as Kannada **{hits[0]['kannada']}**.",
                       blocks=[{"type": "lipi", "letters": hits[:6]}], suggestions=["Show Tulu Lipi vowels"], intent="Tulu Lipi")
        want = next((g for g in groups if norm(g["label"]) in t), None)
        if "vowel" in t:
            want = next((g for g in groups if g["id"] == "vowels"), want)
        if want:
            return eng(f"**{want['label']}** in Tulu Lipi:", blocks=[{"type": "lipi", "letters": [dict(l, cp=l.get("codepoint")) for l in want["letters"]]}],
                       suggestions=["What is Tulu Lipi?"], intent="Tulu Lipi")
        return eng("**Tulu Lipi** (the Tulu-Tigalari script) is Tulu's own historic writing system, used for palm-leaf manuscripts. "
                   "It was added to Unicode in version 16.0 (2024). Today most Tulu is written in the Kannada script.",
                   suggestions=["Show Tulu Lipi vowels", "How do you write ma in Tulu Lipi?"], intent="Tulu Lipi")

    # ------------------------------------------------ known phrases
    def _conversational(self, e, mem):
        said = {"type": "phrases", "title": "What you said, in Tulu", "items": [item(e)]}
        k = e["tulu"].rstrip("?").strip()
        if k == "ಎಂಚ ಉಲ್ಲರ್":
            return tulu("ಎಂಕ್ ಎಡ್ಡೆ ಉಂಡು. ಈರೆಗ್ ಎಂಚ ಉಂಡು?", "enk edde undu. eereg encha undu?", "I am well. How are you?",
                        blocks=[said], suggestions=["I am well", "Teach me greetings"], intent="Greetings")
        if k == "ಈರೆನ ಪುದರ್ ದಾದ":
            return tulu("ಎನ್ನ ಪುದರ್ ತುಳು ಮಿತ್ರ.", "enna pudar Tulu Mitra.", "My name is Tulu Mitra.",
                        blocks=[said], suggestions=["My name is Nihal", "What can you do?"], intent="Greetings")
        if k == "ಎಂಕ್ ಎಡ್ಡೆ ಉಂಡು":
            return tulu("ಎಡ್ಡೆ!", "edde!", "Good! Glad you're well.", blocks=[said],
                        suggestions=["Teach me food words", "Quiz me"], intent="Greetings")
        if k == "ಸೊಲ್ಮೆಲು":
            return self._greeting(mem)
        if k == "ಬೊಕ್ಕ ತಿಕ್ಕುಗ":
            return self._farewell("", "", mem)
        if e.get("number"):
            return self._numbers(str(e["number"]), str(e["number"]), mem)
        if len(e["tulu"].split()) == 1:
            return self._meaning(e["tulu"], f"meaning of {e['tulu']}", mem)
        return eng(f"**{e['tulu']}** ({e.get('roman')}) means “{e.get('english')}”.", blocks=[said],
                   suggestions=["Quiz me", "Teach me daily phrases"], intent="Chat")

    # ------------------------------------------------- open questions
    def _open_question(self, text, history, mem):
        if llm.available():
            try:
                data = llm.ask_json(text, history)
                blocks = []
                if data.get("explanation"):
                    blocks.append({"type": "text", "text": data["explanation"]})
                blocks.append({"type": "note", "text": "AI-generated reply — the Tulu may contain mistakes."})
                if data.get("tulu"):
                    return tulu(data["tulu"], data.get("roman") or None, data.get("english") or None,
                                blocks=blocks, suggestions=starters(), intent="Chat", source="llm")
                return eng(data.get("explanation") or "…", blocks=blocks[1:], suggestions=starters(), intent="Chat", source="llm")
            except llm.LLMError:
                log.warning("LLM unavailable, falling back")
        spotted = [e for e in self.d.entries if not e.get("number") and len(e.get("english") or "") > 2
                   and f" {norm(e['english'])} " in f" {norm(text)} "][:5]
        blocks = [{"type": "phrases", "title": "Words I recognised", "items": [item(e) for e in spotted]}] if spotted else []
        blocks.append({"type": "note", "text": "Open questions need the language model, which isn't configured on this server."
                       if not llm.available() else "The language model couldn't be reached just now."})
        return eng("I don't have an answer to that in my Tulu data.", blocks=blocks,
                   suggestions=starters(), intent="Chat", source="none")
