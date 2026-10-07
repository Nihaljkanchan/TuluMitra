# Data

| File | What | Source |
|---|---|---|
| `tulu_lexicon.json` | 130 curated Tulu words/phrases with Latin reading, English and Kannada meanings | exported from the frontend's data files |
| `tulu_lessons.json` | lesson categories and sentences | exported from the frontend; replace with your own 8-category file if you prefer (both shapes load) |
| `tulu_lipi_map.json` | Tulu-Tigalari letters ↔ Kannada, Unicode-verified | frontend |
| **`Tulu_Corpus_clean.txt`** | **73,872 cleaned Tulu sentences, 150,990 unique words** — the dictionary's corpus | your Tulu Wikipedia corpus, cleaned by `training/clean_corpus.py` |
| `sample_corpus.txt` | 39 sample sentences, used only if the corpus file is missing | demo data |

The dictionary indexes every word of the corpus at start-up (about 1.5 s,
~70 MB RAM), so any Kannada-script Tulu word shows its real frequency and
example sentences. To rebuild from a new version of the raw corpus:
`python training/clean_corpus.py <raw file>` and copy the `_clean.txt` here.

To add vocabulary, add entries to `tulu_lexicon.json` in the same shape:
`{"tulu", "roman", "english", "english_alts": [...], "kannada": [...]}`.
