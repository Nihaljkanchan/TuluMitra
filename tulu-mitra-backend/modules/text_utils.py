"""Small text helpers shared by every module."""

import re
import unicodedata

KANNADA_RE = re.compile(r"[ಀ-೿]")
KANNADA_WORD_RE = re.compile(r"[ಀ-೿‌‍]+")
ZW_RE = re.compile(r"[‌‍]")
PUNCT_RE = re.compile(r"[?!.,;:\"“”()\[\]{}।॥]")


def norm(s: str) -> str:
    """Lower-case, drop punctuation, apostrophes and zero-width joiners, squeeze spaces."""
    s = (s or "").lower()
    s = ZW_RE.sub("", s)
    s = re.sub(r"[’‘`']", "", s)
    s = PUNCT_RE.sub(" ", s)
    s = s.replace("-", " ")
    return re.sub(r"\s+", " ", s).strip()


def key(s: str) -> str:
    """Comparison key: normalised with no spaces."""
    return norm(s).replace(" ", "")


def is_kannada(s: str) -> bool:
    return bool(KANNADA_RE.search(s or ""))


def kannada_words(sentence: str):
    """Kannada-script tokens of a sentence, without joiners."""
    return [ZW_RE.sub("", w) for w in KANNADA_WORD_RE.findall(sentence or "")]


def fold(s: str) -> str:
    """Strip diacritics: ṭa → ta."""
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn").lower()


def sound(s: str) -> str:
    """How a learner might spell it by ear: neer ≈ nir, pudar ≈ pudhar."""
    s = re.sub(r"[^a-z]", "", key(fold(s)))
    s = re.sub(r"(ee|ii)", "i", s)
    s = re.sub(r"(oo|uu)", "u", s)
    s = s.replace("aa", "a")
    s = re.sub(r"([bcdghjklmnprstvy])h", r"\1", s)
    s = re.sub(r"(.)\1+", r"\1", s)
    return s.replace("w", "v")


def distance(a: str, b: str) -> int:
    """Levenshtein edit distance."""
    if a == b:
        return 0
    if not a or not b:
        return len(a or b)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


KN_DIGITS = {chr(0x0CE6 + i): str(i) for i in range(10)}


def ascii_digits(s: str) -> str:
    return "".join(KN_DIGITS.get(c, c) for c in s or "")


ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
        "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
        "eighteen", "nineteen"]
TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]


def english_number(n: int) -> str:
    if n == 100:
        return "one hundred"
    if n < 20:
        return ONES[n]
    t = TENS[n // 10]
    return f"{t} {ONES[n % 10]}" if n % 10 else t


NUMBER_BY_NAME = {english_number(n): n for n in range(1, 101)}
NUMBER_BY_NAME["hundred"] = 100


def read_number(s: str):
    t = norm(ascii_digits(s))
    if t.isdigit():
        return int(t)
    return NUMBER_BY_NAME.get(t)
