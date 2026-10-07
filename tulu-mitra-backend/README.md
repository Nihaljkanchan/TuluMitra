# ತುಳು ಮಿತ್ರ · Tulu Mitra — backend

Flask REST API behind the Tulu Mitra website: conversation, dictionary,
translation, lessons and quizzes, speech recognition, speech synthesis and
voice personalisation — plus the pipeline to train speech models on your
own Tulu recordings.

```
tulu-mitra-backend/
├── app.py                 all HTTP endpoints
├── config.py              every setting (read from .env)
├── modules/
│   ├── conversation.py    turns a message into a reply (rules → Claude → honest "don't know")
│   ├── intent_detector.py what the user wants (edit keyword lists here)
│   ├── dictionary.py      curated word list + the cleaned 73,872-sentence corpus
│   ├── translation.py     English/Kannada ↔ Tulu
│   ├── concept_teaching.py lessons and quizzes
│   ├── llm.py             optional Claude connection
│   ├── asr.py             Whisper (+ your fine-tuned LoRA adapter)
│   ├── tts.py             your Tulu voice → Kannada stand-in → none
│   ├── voice.py           voice samples + optional kNN-VC personalisation
│   ├── feedback.py        visitors' mistake reports → approved corrections
│   ├── admin_content.py   the data files the Admin page edits (checked before saving)
│   ├── store.py           safe JSON saving with automatic backups
│   └── audio_utils.py     browser audio → 16 kHz WAV (ffmpeg)
├── data/                  word list, lessons, Tulu Lipi map, corpus (see data/README.md)
├── models/                trained models go here (see models/README.md)
├── training/              recordings → dataset → fine-tuned Whisper (see training/README.md)
└── tests/test_api.py      27 tests: pytest -q
```

## What works with what

| Feature | Needs | Without it |
|---|---|---|
| Chat, dictionary, translate, lessons, quiz | nothing extra | — |
| Real corpus frequencies/examples | `data/Tulu_Corpus_clean.txt` (included) | uses a 39-sentence sample |
| Open questions, AI translation | `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `.env` | says it doesn't know |
| Speech → text (`/asr`) | `requirements-ml.txt`; accurate only after training | 503; the site shows "couldn't understand" |
| Text → speech (`/tts`) | `requirements-ml.txt` | no audio; the site uses the browser's voice |
| Natural Indian voice | `pip install git+https://github.com/huggingface/parler-tts.git` (needs Git) | Meta's MMS Kannada voice |
| Tulu voice (not Kannada) | a model in `models/tulu-tts/` | an Indian Kannada voice reads the Tulu |
| Personalised voice | `VOICE_CONVERSION=knnvc` + ML packages | samples stored, default voice used |
| Admin page, mistake reports | `ADMIN_PASSWORD` in `.env` | reports are stored; Admin page is off |

`GET /health` reports exactly which of these are active.

## 1. Run it locally

Needs Python 3.10+ and ffmpeg (`winget install ffmpeg` · `brew install ffmpeg` · `sudo apt install ffmpeg`).

```bash
cd tulu-mitra-backend
python -m venv .venv
.venv\Scripts\activate            # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env              # Windows: copy .env.example .env
python app.py                     # → http://localhost:8000/health
```

The cleaned corpus is already in `data/`. For speech, also `pip install -r requirements-ml.txt` (a few GB; the first
/asr and /tts requests download Whisper and the MMS voice, then cache them).

Run the tests any time: `pip install pytest && pytest -q`.

### Indian voice

Speech output picks the best engine installed, in this order:

1. your own Tulu voice (`models/tulu-tts/`, see training/README.md)
2. **Indic Parler-TTS** by AI4Bharat — natural Indian Kannada speakers,
   **Suresh** (male) or **Anu** (female); Apache-2.0 licence
3. Meta's MMS Kannada voice
4. none — the website then uses the best Indian voice in the viewer's own
   browser (Kannada, else Telugu or Hindi with the text converted to that
   script, else Indian English; never an American voice reading Kannada)

To enable the Indian voice, after `requirements-ml.txt`:

```bash
pip install git+https://github.com/huggingface/parler-tts.git
```

This needs **Git** installed (git-scm.com). The model (a few GB) downloads on
the first play. Choose the speaker in `.env` with `TTS_SPEAKER=Suresh` or
`TTS_SPEAKER=Anu`. On a laptop CPU each new sentence takes several seconds
to generate; repeats are instant because audio is cached. `/health` shows
the active engine and speaker.

### Personalised voice ("My voice")

1. Install the speech packages (`pip install -r requirements-ml.txt`).
2. In `.env`: `VOICE_CONVERSION=knnvc`, then restart `python app.py`.
3. On the website: **Add your voice** (Home page, bottom) → record or upload
   6–30 s → **Use this voice**. The panel then shows what the server is
   doing, from `GET /voice/status`:
   - *Preparing your voice…* — the first time, the server downloads kNN-VC
     from GitHub (WavLM-Large ≈ 1.2 GB + vocoder ≈ 60 MB). This takes
     several minutes; the backend terminal shows the download. It is cached
     afterwards (`%USERPROFILE%\.cache\torch\hub` on Windows).
   - *Ready* — press **Test my voice**, then **Use my voice for answers**
     (or pick **My voice** in the navbar's Voice menu).
   - Anything else says exactly what is missing (setting off, packages
     missing, sample not on the server, download failed).
4. It is **not training**: each answer is spoken by the normal voice, then
   converted toward your sample. On a laptop CPU a short phrase takes
   roughly 10–30 s the first time; replays are instant (cached).

If the server is slow or fails, the website speaks with this computer's
voice instead and says why, so a play button never spins for ever.

## 2. Admin page and mistake reports

Set a password in `.env` and restart:

```
ADMIN_PASSWORD=choose-a-long-password
```

Open the website's **/admin** page (link in the footer) and sign in.

- **Reports** — every "Report a mistake" a visitor sent (from a chat reply,
  translation, dictionary result or lesson phrase), with what the site
  showed and the correct words they typed. Edit if needed, then
  **Approve** or **Reject**. **Undo approval** takes a correction back.
- An approved correction is used **immediately, everywhere**: the same
  question / translation / word gets the corrected answer, the wrong Tulu
  text is replaced wherever the backend would show it (chat, translate,
  dictionary, lessons), the phrase is added to the dictionary, and its
  sentence to the corpus examples. It is saved in `data/corrections.json`.
- Every approved correction is also written to
  `training/data/corrections.tsv` (**Corrections → Download for training**)
  so it can go into the data for the next training run. Approving does
  not retrain a neural network by itself.
- **Word list, Lessons, Greetings** — edit the dictionary/translation word
  list, the Learn lessons and the Home greetings in tables (or **Edit as
  JSON** for anything else). Saving checks the data, keeps a backup in
  `storage/backups/`, and the site uses it at once. **System** shows what
  the backend is running and restores earlier versions.

Reports are kept in `storage/feedback.json`. On free cloud hosts (e.g.
Hugging Face Spaces) files written at run time are lost when the server
restarts — download the corrections and copy `data/*.json` back into the
project after admin edits you want to keep.

## 3. Connect the website

In the frontend folder create `.env`:

```
VITE_API_URL=http://localhost:8000
```

restart `npm run dev`, and the chat sidebar changes from **Demo mode** to
**Connected to backend**. In the backend's `.env`, `ALLOWED_ORIGINS` must
include the frontend's address (`http://localhost:5173` for Vite).

The frontend's `src/services/api.js` is the only file that talks to this
API; the response keys below are what it reads.

## 4. API

All bodies are JSON unless noted. Errors return `{"error": "…"}`.

| Endpoint | Request | Response |
|---|---|---|
| `POST /chat` | `{text, language: "english"\|"kannada"\|"tulu", history: [{role,text}], memory: {}}` | `{response, lang, transliteration, english, blocks, suggestions, intent, memory, source, audio_url}` |
| `POST /asr` | form-data `file` (any audio), `language` | `{text, fine_tuned}` · 503 if no model |
| `POST /dictionary` | `{word}` | `{word, frequency, examples, roman, english, found, card, related, sentences, fuzzy}` |
| `POST /translate` | `{text, source, target}` (english→tulu, kannada→tulu, tulu→english) | `{translation, transliteration, method, note}` |
| `POST /tts` | `{text, voice_id?}` (voice_id = "My voice") | `{audio_url, engine, is_tulu_voice, personalised, note, reason}` |
| `POST /upload-voice` | form-data `file` | `{ok, voice_id, seconds, warning, status}` |
| `GET /voice/status?voice_id=` · `POST /voice/prepare {voice_id}` | | `{ready, message, conversion, tts}` |
| `POST /feedback` | `{kind, input, direction, shown:{tulu,roman,english}, suggested:{…}, note, reporter}` | `{ok, id}` |
| `GET /content` | | `{lessons, greetings}` (as edited on the Admin page) |
| `/admin/*` | header `X-Admin-Password` | see app.py |
| `GET /health` | | status of every component |
| `GET /lessons` · `POST /learn {category}` · `POST /quiz {kind, category}` | | lessons / one lesson / one question |
| `POST /search {keyword}` · `GET /dictionary/top?n=50` | | corpus sentences / most frequent words |
| `POST /intent {text}` | | `{intent}` |

`memory` is how multi-turn features (your name, a running quiz, which
lesson you're on) work without server sessions: the server returns it,
the website stores it with the chat, and sends it back next time.

## 5. Make it live

Two parts, two free hosts:

```
Browser ──► Frontend (static site)      ──► Backend (Flask API)
            Vercel / Netlify                  Hugging Face Spaces (Docker)
            VITE_API_URL=https://…hf.space    ALLOWED_ORIGINS=https://….vercel.app
```

Both must be **https** — browsers block microphone access and mixed
http/https requests otherwise. Every host below gives you https.

### Backend → Hugging Face Spaces (recommended: enough memory for Whisper)

1. huggingface.co → **New Space** → SDK **Docker** → hardware **CPU basic** (free).
2. Upload the contents of this folder (web "Add file → Upload files", or
   `git clone` the Space and copy files in). The 18 MB corpus is fine — the
   web uploader handles large files; with git, run `git lfs install` first. Include `models/whisper-tulu-lora/`
   once trained, and your corpus file in `data/`.
3. Replace the Space's `README.md` header with `deploy/hf-space-README.md`
   (it tells Spaces to use port 7860).
4. For speech models, edit the Dockerfile's `ARG WITH_ML=0` to `1`.
5. Space **Settings → Variables and secrets**: add `ALLOWED_ORIGINS`
   (your frontend URL) and, optionally, the secret `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`).
6. When it's built, your API is `https://<user>-<space>.hf.space`. Check `/health`.

Free CPU Spaces sleep after a period without visits and take a minute to
wake; open the site a few minutes before a demo. Whisper on CPU takes a
few seconds per utterance.

### Backend alternatives

- **Render / Railway** (free or cheap): connect the repo, it uses the
  `Procfile`. Free tiers have ~512 MB RAM — fine for the light build (chat,
  dictionary, translation), not enough for speech models.
- **Your laptop, for demo day**: run `python app.py`, then
  `cloudflared tunnel --url http://localhost:8000` (free, no account) gives a
  temporary https URL to put in `VITE_API_URL`. Uses your laptop's GPU if it has one.

### Frontend → Vercel (or Netlify)

1. Push the frontend folder to GitHub.
2. vercel.com → **Add New Project** → import it. Framework: Vite (auto-detected).
3. **Environment variable** `VITE_API_URL` = your backend URL (no trailing slash). Deploy.
4. Put the Vercel URL into the backend's `ALLOWED_ORIGINS` and restart the Space.

`vercel.json` / `public/_redirects` (already in the frontend) make page
refreshes on `/learn`, `/dictionary` etc. work. On Netlify: build command
`npm run build`, publish directory `dist`.

## 6. Train on your recordings

See **training/README.md** — record → `prepare_dataset.py` →
`train_whisper_lora.py` on Colab (`Tulu_Whisper_LoRA_Colab.ipynb`) → copy
`models/whisper-tulu-lora/` here → restart. `metrics.json` gives base vs
fine-tuned WER/CER for your report.

## Honest limits (worth stating in the report)

- The rule-based conversation only knows what's in `data/`; open
  questions need the LLM, and LLM Tulu can contain mistakes (replies are
  labelled "AI-generated").
- Whisper has no Tulu language token; Kannada is used as the proxy.
- Until a Tulu VITS voice is trained, speech output is a Kannada voice.
- Google's Cloud Translation API does not list Tulu, so it isn't used.
