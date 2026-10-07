"""
Intent detection for Tulu Mitra — keyword and pattern rules with priority
routing. Works on English, Kannada and Tulu (Kannada script or Latin).

detect(text) -> {"intent": str, "slot": str | None}

Intents, in priority order:
    quiz, numbers, lipi, teaching, dictionary, translation,
    about, help, greeting, farewell, thanks, name, conversation
To add a keyword, edit the lists below — nothing else needs to change.
"""

import re

from modules.text_utils import norm

GREET = re.compile(r"^(hi+|hello+|hey+|helo|hai|namaste|namaskara?|good (morning|afternoon|evening)|ಸೊಲ್ಮೆಲು|ನಮಸ್ಕಾರ|ನಮಸ್ತೆ)(?=\s|$)")
# (Not \b: Python does not count Kannada vowel signs as word characters,
#  so \b after a word ending in a vowel sign never matches.)

PATTERNS = [
    ("quiz", [r"\bquiz\b", r"test me", r"\bpractice\b", r"\bpractise\b", r"ask me"]),
    ("numbers", [r"\bcount\b", r"\bnumbers?\b", r"^\d+$", r"(what is|whats|say) \d+ in tulu", r"ಸಂಖ್ಯೆ"]),
    ("lipi", [r"tulu lipi", r"tigalari", r"\blipi\b", r"ಲಿಪಿ"]),
    ("teaching", [r"\bteach\b", r"\blearn\b", r"\blesson\b", r"next lesson", r"ಕಲಿ"]),
    ("dictionary", [r"\bmeaning\b", r"what does .+ mean", r"\bdefine\b", r"ಅರ್ಥ"]),
    ("translation", [r"\btranslate\b", r"in tulu$", r"how (do|would|can|should) (you|i|we) say", r"how to say",
                     r"tulu (word )?for", r"ತುಳುವಿನಲ್ಲಿ", r"ತುಳುವಲ್ಲಿ", r"ಅನುವಾದ"]),
    ("about", [r"who (made|built|created|developed) you", r"about (the |this )?(project|app)", r"how do you work",
               r"your (team|creator|developer)"]),
    ("help", [r"^help$", r"what can you do", r"features", r"how to use", r"ಸಹಾಯ"]),
    ("farewell", [r"^(bye|goodbye|see you|good night|ok bye)(?=\s|$)", r"ಬೊಕ್ಕ ತಿಕ್ಕುಗ"]),
    ("thanks", [r"\b(thanks|thank you|thank u|thx)\b", r"ಧನ್ಯವಾದ"]),
    ("name", [r"^(my name is|call me)\s+", r"^ಎನ್ನ ಪುದರ್\s+", r"^ನನ್ನ ಹೆಸರು\s+"]),
]

COMPILED = [(intent, [re.compile(p) for p in pats]) for intent, pats in PATTERNS]


def detect(text: str) -> dict:
    t = norm(text)
    if not t:
        return {"intent": "empty", "slot": None}
    for intent, pats in COMPILED:
        if any(p.search(t) for p in pats):
            return {"intent": intent, "slot": None}
    if GREET.search(t):
        return {"intent": "greeting", "slot": None}
    return {"intent": "conversation", "slot": None}


if __name__ == "__main__":
    tests = {
        "hello": "greeting", "ಸೊಲ್ಮೆಲು": "greeting", "what does ನೀರ್ mean": "dictionary",
        "how do you say water in tulu": "translation", "teach me greetings": "teaching",
        "quiz me": "quiz", "count from 1 to 10": "numbers", "what can you do": "help",
        "tell me about yakshagana": "conversation",
    }
    ok = sum(detect(k)["intent"] == v for k, v in tests.items())
    for k, v in tests.items():
        print(f"{k:32} -> {detect(k)['intent']:12} (expected {v})")
    print(f"{ok}/{len(tests)} correct")
