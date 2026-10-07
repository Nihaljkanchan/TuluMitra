# Training on your Tulu recordings

Two models can learn from your recordings:

| Model | What it learns | Needs | Where it goes |
|---|---|---|---|
| **ASR** — Whisper + LoRA | Tulu speech → Kannada-script text | Many speakers, any number of sentences | `models/whisper-tulu-lora/` |
| **TTS** — VITS | Kannada-script Tulu text → Tulu speech | ONE speaker, clean audio, ideally 1 hour+ | `models/tulu-tts/` |

The backend checks those folders at start-up. Put a trained model there,
restart, and `/asr` or `/tts` uses it — no code changes.

---

## 0. Clean the text corpus (once)

```bash
python training/clean_corpus.py data/Tulu_Wikipedia_Corpus_82919_sentences.txt
```

Repairs a recurring corruption of ಬುಕ್ಕೊ ("and") left by a bulk edit on
Tulu Wikipedia, rejoins sentences that were split at initials (ಕೆ. / ಡಾ.),
strips invisible characters and wiki markup, and sets aside Kannada-language
lines, titles/fragments, citations and duplicates. Everything it changes or
removes is listed with a reason in `*_review.tsv`. Point the backend's
`CORPUS_FILE` at the `*_clean.txt` it writes.

The text corpus is not ASR training data by itself — Whisper learns from
audio paired with transcripts. The corpus feeds the dictionary, and is the
best source for choosing more sentences to record.

## 1. Record

The script is `recording_script.csv` — the 160 sentences of
**Tulu_Recording_Script.pdf**, with these columns:

| column | what it is |
|---|---|
| `id`, `number` | S001 … S160 = the sentence number in the PDF |
| `roman` | the sentence exactly as written in the PDF (Latin letters) |
| `tulu` | the same sentence in Kannada script — a **first draft**, please check it |
| `english`, `category` | from the PDF |
| `status` | `ok`, `check` (see note) or `skip` (17, 19, 25 have a blank ___) |
| `note` | why a line is marked `check`: words that look like Kannada rather than Tulu, a different word in the project's own word list, or a sentence that appears twice |

Open it in Excel, go through the `check` lines with a Tulu speaker, and fix
the `tulu` column so it matches **what was actually said** in the recordings
(if a sentence itself was wrong, re-record it). The speech model learns to
write exactly this text.

**File names.** Name each file with the speaker and the sentence number,
as in the PDF's instructions: `Ab_001.wav`, `Ab_002.wav` … `Nihal_001.m4a` …
Copy them into `training/recordings/` — all together, or one folder per
person. Then check what is there:

```bash
python training/prepare_dataset.py --check
```

It lists, per speaker, how many sentences are recorded and which numbers are
missing, and any file it can't use (wrong name, duplicate, unknown number).
Sentences 17, 19 and 25 ("My name is ___") differ per person: list what each
person said in `training/recordings/metadata.csv` (`file,text,speaker`) or
leave them out.

**How much is enough?** Each sentence is 1–3 s, so 160 sentences are about
4–8 minutes per speaker. That is enough to fine-tune speech *recognition*
on these sentences for a demo (more speakers help more than more takes),
and to evaluate it honestly on held-out sentences. It is not enough to
train a new *text-to-speech* voice (section 3 needs an hour or more from
one speaker) — but it is ideal as the reference for **My voice**:

```bash
python training/make_voice_reference.py --speaker Ab
```

joins up to 5 minutes of Ab's clips into one reference in
`storage/voices/` and prints a link; open it once in the browser and the
site uses that voice (backend needs `VOICE_CONVERSION=knnvc`).

## 2. Prepare → train → evaluate (Google Colab)

Open `Tulu_Whisper_LoRA_Colab.ipynb` in Colab and run the cells, or run the
scripts yourself on any GPU machine:

```bash
pip install -r training/requirements-train.txt
python training/prepare_dataset.py            # → training/processed/
python training/train_whisper_lora.py         # → models/whisper-tulu-lora/ + metrics.json
python training/evaluate_asr.py               # → results/asr_predictions.csv (optional)
```

| Script | Does |
|---|---|
| `prepare_dataset.py` | converts to 16 kHz mono, trims silence, drops unusable clips, splits train/test with no leakage, writes `report.json` (hours, clips, speakers) |
| `train_whisper_lora.py` | scores base Whisper, trains LoRA (r=8, α=32 on q_proj/v_proj), keeps the best epoch, scores the fine-tuned model, saves adapter + `metrics.json` |
| `evaluate_asr.py` | WER/CER for base vs fine-tuned, and every prediction per clip for error analysis |

**For your report**, `metrics.json` has everything: dataset size, baseline
WER/CER, fine-tuned WER/CER, and example predictions.

**What to expect, honestly.** A few hundred recordings is a small dataset.
The fine-tuned model will improve most on the recorded sentences and
sentences like them; on unrelated speech it will still make many errors.
That's a normal, defensible result for a low-resource language — report the
held-out test numbers as they are, and describe the split you used
(`--split sentence` tests unseen sentences; `--split speaker` tests an
unseen voice).

Whisper has no Tulu language token; the scripts use **Kannada** because
Tulu is written in Kannada script and is phonologically close. Keep
`WHISPER_LANGUAGE=kannada` in the backend `.env` to match.

## 3. A Tulu voice (TTS) — optional, more work

Until you train one, the backend reads Tulu with Meta's MMS **Kannada**
voice (`facebook/mms-tts-kan`) and reports that it is a Kannada voice.

To train a real Tulu voice, fine-tune that same MMS Kannada VITS model on
one speaker's Tulu recordings. The community project
[`ylacombe/finetune-hf-vits`](https://github.com/ylacombe/finetune-hf-vits)
does exactly this for MMS models; follow its README with:

- base model: `facebook/mms-tts-kan` (Kannada script matches your text)
- dataset: `training/processed/train.csv` filtered to **one speaker**
  (`audio` and `text` columns are already in the right form)
- output: save the final model folder as `models/tulu-tts/`

Its steps, briefly: convert the discriminator checkpoint for the base
model (`convert_original_discriminator_checkpoint.py --language_code kan`),
write a JSON config pointing at your data (examples in its
`training_config_examples/`), then
`accelerate launch run_vits_finetuning.py your_config.json`. Its README
reports usable results from **80–150 clips in about 20 minutes** on one GPU,
because the model is small (83M parameters) — so your 200-sentence script
from a single clear speaker is a realistic starting point.

The backend loads the result with `VitsModel.from_pretrained("models/tulu-tts")`.
MMS checkpoints and anything fine-tuned from them are licensed CC-BY-NC 4.0
(fine for an academic project, not for commercial use).

## 4. Personalised voice

Separate from training: with `VOICE_CONVERSION=knnvc` in `.env`, speech is
generated in the default voice and then converted toward the user's
uploaded sample with [kNN-VC](https://github.com/bshall/knn-vc). No
training needed. The app's 6–30 second sample gives a rough resemblance;
kNN-VC's authors report quality keeps improving with more reference
speech, up to about 5 minutes.

## 5. Corrections from visitors → training data

When the admin approves a visitor's correction (Admin page → Reports), it is
used by the website at once, and also appended to
`training/data/corrections.tsv` (columns: kind, input, wrong_tulu, tulu,
roman, english, approved). Use it at the next training run:

- **Text / corpus:** add the `tulu` column to the corpus before running
  `clean_corpus.py`, so frequencies and examples include corrected Tulu.
- **Speech (ASR/TTS):** use the corrected `tulu` sentences as the script
  when recording new clips (section 1) — they are sentences a real user
  needed and the model got wrong.
- **Translation / word list:** rows with both `tulu` and `english` are
  already merged into the running word list; to make them permanent in the
  file, edit them in on the Admin page's Word list tab (or copy them into
  `data/tulu_lexicon.json`).

Approving never retrains a model by itself — training stays a deliberate
step you run and evaluate.
