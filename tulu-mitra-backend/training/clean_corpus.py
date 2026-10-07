"""
Clean the Tulu Wikipedia text corpus.

    python training/clean_corpus.py data/Tulu_Wikipedia_Corpus_82919_sentences.txt

Writes, next to the input:
    <name>_clean.txt       one Tulu sentence per line — use this for training
    <name>_fragments.txt   titles, names, captions (useful vocabulary, not sentences)
    <name>_kannada.txt     lines written in Kannada, not Tulu
    <name>_review.tsv      every line that was changed, merged or set aside, with the reason

What it does — fixes are exact, everything uncertain is set aside, never guessed:
  1. Removes invisible junk (BOM, zero-width space, soft hyphen, direction marks),
     stray zero-width joiners at word edges, and doubled spaces.
  2. Repairs a mechanical corruption from a bulk edit on Tulu Wikipedia that
     damaged the word ಬುಕ್ಕೊ ("and"): ಬುಕ್ಕೊ್ಕ / ಬುಕ್ಕೊ್ / ಬುಕ್ಕೊ್ಮ → ಬುಕ್ಕೊ,
     ಬುಕ್ಕೊೊಂಜಿ → ಬುಕ್ಕೊಂಜಿ (the extra vowel sign dropped), ಬುಕ್ಕೊ್ಮಾಲ್ → ಬುಕ್ಮಾಲ್ (Bokmål).
  3. Rejoins a vowel sign or ಂ separated from its letter by a space (ಬತ್ತ್ ಂಡ್ → ಬತ್ತ್ಂಡ್).
  4. Rejoins sentences the original splitter cut at an initial ("… ಕೆ." + "ಸುಧಾಕರನ್ …").
  5. Removes leftover wiki markup ([[ ]], {{ }}, &nbsp; …) and space before punctuation.
  6. Sets aside: Kannada-language lines, remaining malformed letter sequences,
     citations/ISBNs, mostly-Latin lines, titles/fragments, near-duplicates.
"""

import argparse
import re
import sys
import unicodedata
from pathlib import Path

V = "ಾ-ೌೕೖೢೣ"  # Kannada dependent vowel signs
MALFORMED = re.compile(rf"[{V}]್|[{V}][{V}]|್್|[ಂಃ][{V}್]|[ಅ-ಔ][{V}್]")
KN_WORD = re.compile(r"[ಀ-೿‌‍]+")
ZW = re.compile(r"[‌‍]")

# ---------------------------------------------------------------- language
TULU_W = set("""ಉಂಡು ಇಜ್ಜಿ ಬೊಕ್ಕ ಆಪುಂಡು ಆದುಂಡು ಉಂದು ಒಂಜಿ ಆಯೆ ಆಲ್ ಏರ್ ಎಂಕ್ ಈರ್ ಯಾನ್ ಇನಿ ಇತ್ತುಂಡು ಇತ್ತೆ
ಅಂಚ ಅಂಚನೆ ಇಂಚ ಇಂಚನೆ ದಾದ ದಾಯೆ ಪಂಡ ಪನ್ಪೆರ್ ಪನ್ಪುನೆ ಪನ್ಪುನ ಮಲ್ಪುನ ಮಲ್ಪುನೆ ಮಲ್ತೆರ್ ಮಲ್ತ್ ಆಯಿನ ಆಂಡ ಆಂಡ್
ಆದ್ ಉಪ್ಪುನ ಇತ್ತಿನ ಬೊಕ್ಕೊ ಅಯಿಡ್ದ್ ಅಯಿಕ್ ಉಂತುಂಡು ಕೊರ್ಪುಂಡು ಒರ್ತಿ ಒರಿ ಆರ್ ಅಕುಲು ಮೆರೆನ ದುಂಬು ಉಂದೆನ್
ಅವೆನ್ ಅಯಿತ ಬತ್ತೆರ್ ಪೋಯೆರ್ ಬೇತೆ ನನ ಮಾತ ಮಾತೆರ್ ಏತ್ ದಿಂಜ ಮಸ್ತ್ ಬಾರಿ ಲಾ ಬುಕ್ಕ ಬುಕ್ಕೊ ಅವು ಇಂದೆನ್ ಪನ್ಪಿನ
ಮಲ್ಪುವೆರ್ ಮಲ್ಪುವೆ ಆಪುನ ತಿಕ್ಕುಂಡು ಆಯಿ ಅಪಗ ಇಪ್ಪುಂಡು ಉಪ್ಪುಂಡು""".split())
KANNADA_W = set("""ಇದೆ ಇದ್ದಾರೆ ಇದ್ದರು ಇತ್ತು ಮತ್ತು ಹಾಗೂ ಎಂದು ಎಂಬ ಆಗಿದೆ ಆಗಿದ್ದಾರೆ ಆಗಿ ಆದರೆ ಅವರು ಅವರ ಇದು
ಇವರು ಇವರ ಅದು ಆದ್ದರಿಂದ ಮಾಡಿದರು ಮಾಡಿದ ಮಾಡಲು ಮಾಡುತ್ತಾರೆ ಮಾಡಲಾಗಿದೆ ಹೆಚ್ಚು ಇರುವ ಇದ್ದ ಬಂದ ಹೋದ ಹೇಳಿದರು
ಎಂಬುದು ಎನ್ನುವ ಎಲ್ಲಾ ಬಗ್ಗೆ ಅಲ್ಲಿ ಇಲ್ಲಿ ನಂತರ ಸಹ ಕೂಡ ಹಾಗೆ ಇಲ್ಲ ದೊರೆತ ಪಡೆದ ನೀಡಿದ ಬರೆದ ಮೂಲಕ ಅಥವಾ
ಹಲವು ಅನೇಕ ಒಂದು ಎರಡು ಆಗುತ್ತದೆ ಇರುತ್ತದೆ ಮಾಡುತ್ತದೆ ನೀಡುತ್ತದೆ ಬಳಸಲಾಗುತ್ತದೆ ಕರೆಯಲಾಗುತ್ತದೆ""".split())
KN_SUFFIX = re.compile(r"(ದಲ್ಲಿ|ಯಲ್ಲಿ|ನಲ್ಲಿ|ಗಳಲ್ಲಿ|ಗಳನ್ನು|ವನ್ನು|ಯನ್ನು|ನ್ನು|ತ್ತದೆ|ತ್ತಾರೆ|ತ್ತಿದ್ದ|ದ್ದಾರೆ|ಲಾಗಿದೆ|ಗಳು|ಗಳ)$")
TU_SUFFIX = re.compile(r"(ವೆರ್|ಯೆರ್|ತೆರ್|ದೆರ್|ಪುವೆ|ಪುನ|ಲೆಕ್|ಡ್ದ್|ಟ್ದ್|ಗ್|ನ್|ದ್|ತ್|ಡ್|ಟ್|ಡು|ಟು|ಲೆನ್|ಲೆಡ್|ಲೆಗ್|ಕುಲು|ಕುಲೆನ|ಪುಂಡು|ತುಂಡು|ಂಡು|ಪೆರ್|ಲು|ಲೆ|ಒಡು|ಒಲು|ಒಲೆನ್|ಒಗು)$")


def language(line):
    """'tulu' | 'kannada' | 'mixed' | 'unknown' — from distinctive grammar words and endings."""
    words = [ZW.sub("", w) for w in KN_WORD.findall(line)]
    t = sum(w in TULU_W for w in words) + 0.5 * sum(bool(TU_SUFFIX.search(w)) for w in words if len(w) > 3)
    k = sum(w in KANNADA_W for w in words) + 0.7 * sum(bool(KN_SUFFIX.search(w)) for w in words if len(w) > 3)
    if t == 0 and k == 0:
        return "unknown"
    if k >= 2 and k > 2 * t:
        return "kannada"
    if t > 0 and k >= t:
        return "mixed"
    return "tulu"


# ------------------------------------------------------------------- fixes
def fix(line):
    """Exact, safe repairs. Returns (new_line, list_of_fix_names)."""
    done = []
    s = unicodedata.normalize("NFC", line)

    def sub(name, pattern, repl, text, flags=0):
        new = re.sub(pattern, repl, text, flags=flags)
        if new != text:
            done.append(name)
        return new

    s = sub("invisible chars", r"[﻿​­‎‏⁠]", "", s)
    s = sub("stray joiner", r"(^|\s)[‌‍]+|[‌‍]+(?=\s|$|[.,;:!?])", r"\1", s)
    # ಬುಕ್ಕೊ corruption (see module docstring)
    s = sub("ಬುಕ್ಕೊ repair", "ಬುಕ್ಕೊ್ಮಾಲ್", "ಬುಕ್ಮಾಲ್", s)
    s = sub("ಬುಕ್ಕೊ repair", r"ಬುಕ್ಕೊ್[ಕಮ]?(?![ಀ-೿])", "ಬುಕ್ಕೊ", s)
    s = sub("ಬುಕ್ಕೊ repair", rf"ಬುಕ್ಕೊ([{V}])", r"ಬುಕ್ಕ\1", s)
    # vowel sign / anusvara / virama separated from its letter by a space
    s = sub("rejoined vowel sign", rf"(?<=[ಕ-ಹ್{V}]) +(?=[{V}ಂಃ])", "", s)
    # wiki markup leftovers
    s = sub("wiki markup", r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", s)
    s = sub("wiki markup", r"\{\{[^}]*\}\}|\[\d+\]|\[[೦-೯]+\]|&nbsp;|&[a-z]+;|&#\d+;", " ", s)
    s = sub("wiki markup", r"\(\s*[,;]?\s*\)", "", s)
    s = sub("spacing", r"\s+([,.;:!?])(?=\s|$)", r"\1", s)
    s = sub("spacing", r"\s{2,}", " ", s)
    return s.strip(), sorted(set(done))


# An initial is one consonant, optionally with a vowel sign — never a virama
# (…ತ್ ದ್. ends a real sentence) and never a one-syllable word that can end
# a Tulu sentence on its own.
INITIAL_END = re.compile(r"(^|\s)([\u0C95-\u0CB9][\u0CBE-\u0CCC\u0C82]?|ಡಾ|ಶ್ರೀ|ಪ್ರೊ|[A-Z])\.$")
NOT_INITIAL = {"ಲಾ", "ಆ", "ಈ", "ಗ", "ಡ", "ನ", "ದ", "ತ", "ಲ", "ಕ", "ಯಾ"}
CITATION = re.compile(r"ISBN|ಐಎಸ್ಬಿಎನ್|doi|Retrieved|\d+\s*\(\d+\)\s*:|pp?\.\s*\d")
KEY = re.compile(r"[\s​-‍.,!?;:\"'()\-–]")


def is_fragment(line):
    words = line.split()
    ends = re.search(r"[.!?।”\"')]\s*$", line)
    return len(words) <= 2 or (not ends and len(words) <= 4)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("corpus", type=Path)
    args = ap.parse_args()
    src = args.corpus
    lines = [l.strip() for l in src.read_text(encoding="utf-8").split("\n")]
    lines = [l for l in lines if l]

    review = []  # (original_line_no, action, reason, text)

    # 4. rejoin sentences split at an initial
    merged, i = [], 0
    while i < len(lines):
        cur, start = lines[i], i
        while (i + 1 < len(lines) and len(cur.split()) >= 2 and (m := INITIAL_END.search(cur))
               and m.group(2) not in NOT_INITIAL):
            i += 1
            cur = f"{cur} {lines[i]}"
        if i > start:
            review.append((start + 1, "merged", f"split at an initial ({i - start + 1} lines rejoined)", cur))
        merged.append((start + 1, cur))
        i += 1

    clean, fragments, kannada = [], [], []
    seen = set()
    stats = {"input_lines": len(lines), "merged_into": len(merged)}
    for n, raw in merged:
        line, fixes = fix(raw)
        if fixes:
            review.append((n, "fixed", ", ".join(fixes), line))
        if not line:
            continue
        key = KEY.sub("", line)
        if key in seen:
            review.append((n, "removed", "duplicate", line))
            continue
        seen.add(key)
        if MALFORMED.search(line):
            review.append((n, "set aside", "malformed letter sequence — needs a human", line))
            continue
        if CITATION.search(line):
            review.append((n, "removed", "citation / reference", line))
            continue
        letters = [c for c in line if c.isalpha()]
        if letters and sum(c.isascii() for c in letters) > 0.3 * len(letters):
            review.append((n, "removed", "mostly Latin script", line))
            continue
        lang = language(line)
        if lang == "kannada":
            kannada.append(line)
            review.append((n, "set aside", "Kannada, not Tulu", line))
            continue
        if is_fragment(line):
            fragments.append(line)
            continue
        clean.append(line)

    stem = src.with_suffix("")
    out_clean = Path(f"{stem}_clean.txt")
    out_clean.write_text("\n".join(clean) + "\n", encoding="utf-8")
    Path(f"{stem}_fragments.txt").write_text("\n".join(fragments) + "\n", encoding="utf-8")
    Path(f"{stem}_kannada.txt").write_text("\n".join(kannada) + "\n", encoding="utf-8")
    with open(f"{stem}_review.tsv", "w", encoding="utf-8") as f:
        f.write("line\taction\treason\ttext\n")
        for row in sorted(review):
            f.write("\t".join(str(x).replace("\t", " ") for x in row) + "\n")

    from collections import Counter
    actions = Counter((a, r.split(",")[0] if a == "fixed" else r) for _, a, r, _ in review)
    print(f"input lines         {stats['input_lines']:>7,}")
    print(f"after rejoining     {stats['merged_into']:>7,}")
    print(f"clean sentences     {len(clean):>7,}   → {out_clean.name}")
    print(f"titles/fragments    {len(fragments):>7,}")
    print(f"Kannada lines       {len(kannada):>7,}")
    for (a, r), c in sorted(actions.items(), key=lambda x: -x[1]):
        print(f"  {a:9} {c:>6,}  {r}")


if __name__ == "__main__":
    sys.exit(main())
