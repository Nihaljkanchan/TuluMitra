# ತುಳು ಮಿತ್ರ · Tulu Mitra

AI-powered Tulu voice assistant — frontend.

Speak or type in English, Kannada or Tulu and get a Tulu reply with its
English meaning and a Latin-letter reading, look words up in the corpus,
translate between Tulu, English and Kannada, and learn Tulu phrases, numbers
to one hundred, and the script.

A personalised voice can be captured two ways: recorded live in the browser,
or uploaded as an existing audio file.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

## Connect the backend

Create a `.env` file next to `package.json`:

```
VITE_API_URL=http://localhost:8000
```

With `VITE_API_URL` unset the app runs on demo data, so every screen is
demonstrable while the Python backend is offline. A "Demo data" badge appears
in the footer whenever demo mode is active.

Endpoints used (all POST): `/chat`, `/asr`, `/dictionary`, `/translate`,
`/tts`, `/upload-voice`. The matching Flask backend is the separate
`tulu-mitra-backend` folder — its README covers running it, the exact
request/response shapes, and deployment. With the backend connected, the
chat sidebar says **Connected to backend** instead of **Demo mode**.

In live mode `api.js` also sends the chat's `history` and `memory` (so
quizzes and remembered names work across turns), passes the backend's
`blocks`/`suggestions` straight into the chat, and remembers the
`voice_id` from *Add your voice* to personalise later speech.

## Deploy

Build with `npm run build` (output in `dist/`). On Vercel or Netlify, set
the environment variable `VITE_API_URL` to the deployed backend's https
URL. `vercel.json` and `public/_redirects` make refreshing on
`/learn`, `/dictionary` etc. work on those hosts.

## Where to change things

| I want to…                                    | Edit                             |
| --------------------------------------------- | -------------------------------- |
| Match the backend's JSON property names        | `src/services/api.js`            |
| Fix or extend the Tulu phrases                 | `src/data/tulu.js`               |
| Fix the numbers or the Kannada chart           | `src/data/learnExtras.js`        |
| Fix the Tulu Lipi chart                        | `src/data/tuluLipi.js`           |
| Change the demo dictionary / chat replies      | `src/data/demoDataset.js`        |
| Change colours, type, radii, shadows           | `src/styles/global.css`          |
| Adjust the voice visualisation                 | `src/components/VoiceOrb.jsx`    |
| Adjust the mandala motif                       | `src/components/Mandala.jsx`     |

`src/services/api.js` is the only file that knows about the network. Each
response reader accepts several likely key names (`response` / `reply` /
`text`, `audio_url` / `audioUrl` / `audio`, …), so wiring up the real backend
usually means changing nothing — and if it does, it changes one line there and
nothing in the UI.

## Home — the chat

The home page is a full chat app:

- **Sidebar** — *New chat*, search, and every previous chat grouped by date
  (Today, Yesterday, Previous 7 days …). Each shows a title and a one-line
  summary of what it covered (e.g. "Numbers · Quiz — quiz 3/4 — 6 messages").
  Chats can be renamed or deleted. They are saved in the browser
  (localStorage), not sent anywhere.
- **Conversation** — replies type out live; each has copy, regenerate
  (latest reply), a topic tag, and tappable follow-up suggestions. Your own
  messages can be copied or edited and resent. A stop button halts a reply,
  and a jump-to-latest button appears if you scroll up.
- **Rich answers** — phrase lists with a play button per line, word cards
  with corpus examples, Tulu Lipi and Kannada letter tiles, and short stories
  where each Tulu phrase can be tapped to hear it.
- Voice input, the language picker and *Add your voice* work as before; a
  spoken question gets a spoken answer.

**Where answers come from.** With `VITE_API_URL` set, every message goes to
`POST /chat` (the last 10 turns are sent as `history`, which a backend may
use or ignore). Without it, `src/services/demoBrain.js` answers: a
rule-based engine over the project's own Tulu data — greetings and small
talk, "how do you say … in Tulu", word meanings, numbers 1–100, lessons,
multiple-choice quizzes with a running score, Tulu Lipi and Kannada letters,
stories, and facts about Tulu. It remembers your name and quiz state within
a chat. It is **not** a language model: it never invents Tulu, gives a
word-by-word gloss (labelled as such) when it only knows some of the words,
and says so plainly when it doesn't know. The sidebar shows "Demo mode"
whenever this is the source.

## Dictionary

In demo mode the Dictionary searches **every Tulu entry in the project** — the
lesson phrases, the phrasebook, the demo corpus and the numbers 1–100 — and
accepts any of:

- English meaning — `water`, `how are you`, `fifty`
- Tulu in Kannada script — `ನೀರ್`, `ಪುದರ್`
- Tulu in Latin letters — `neer`, `pudar`, and by-ear spellings like `nir`
- Kannada — `ನೀರು`, `ಹೆಸರು`, `ಐವತ್ತು`, Kannada digits `೪೫`
- close misspellings — `watr` (shown as "closest word")

Results are ranked (exact → whole word inside a phrase → prefix → similar
spelling) and show the meaning, Kannada equivalent, source, corpus frequency
and examples where the corpus has them, phrases that use the word, and other
matches. With nothing typed, the page lists the whole word list to browse.
The Kannada equivalents live in `src/data/kannadaGloss.js`. It is a search
over the project's own data, not a trained model: a word that isn't in the
data returns an honest "no match". With `VITE_API_URL` set, searches go to
`POST /dictionary` on the backend instead.

## Learn page

Three sections share one progress tracker (saved per section in the browser):

- **Phrases** — themed everyday sentences, English meaning first.
- **Numbers 1–100** — ten per page. 1–20, the tens and 100 are set words;
  every other number is written as the tens word plus the unit word and is
  labelled **composed** in the interface, because spoken Tulu commonly fuses
  those and the fused spelling varies by region. Verify before presenting.
- **Tulu Lipi** — the Tulu-Tigalari script, Tulu's own writing system,
  encoded in Unicode 16.0 at U+11380–U+113FF. Every codepoint in
  `src/data/tuluLipi.js` was generated from the Unicode character database and
  checked against its official character name.
  **No font for this script ships with any operating system and none is on
  Google Fonts, npm or Fontsource**, so by default the letters cannot be
  drawn. The page detects this and falls back to each letter's Kannada
  counterpart with an explanation, instead of showing empty boxes. Drop a font
  into `public/fonts/` (see the README there) and the real letterforms appear
  with no other change.
  Short **e** and short **o** are not encoded in Unicode yet — only the long
  forms — so those two cards carry no glyph rather than borrowing the wrong one.
- **Kannada script** — what Tulu is written in day to day, and what the
  project corpus uses.

## Notes

- Recording uses `MediaRecorder`; the visualiser is driven by real microphone
  amplitude through a Web Audio `AnalyserNode`, not a fixed animation loop.
- Microphone capture requires `localhost` or HTTPS.
- Every phrase, number and reply carries `tulu` (Kannada script), `roman`
  (Latin letters) and an English meaning, so someone who reads neither Indic
  script can still follow along.
- With no `/tts` connected, play buttons fall back to the browser's own speech
  synthesis (a Kannada system voice if one is installed) so a demo is audible.
  That is the operating system's voice, not this project's TTS model, and it
  is replaced the moment a real `/tts` endpoint returns audio.
- The Tulu content in `src/data/` is sample content. Have a native speaker or
  the project corpus verify it before the demo — those files are the only
  place it appears.

## Structure

```
src/
├── components/   Navbar, MicButton, VoiceOrb, Mandala, ChatComposer,
│                 ChatMessage, AudioButton, VoiceUpload, LanguagePicker,
│                 Toast, Segmented, ProgressRing…
├── pages/        Home, Dictionary, Translate, Learn, About
├── services/     api.js (single integration point) · mock.js · demoBrain.js (demo chat engine)
├── hooks/        useRecorder, useAudioPlayer, useProgress
├── data/         tulu.js · learnExtras.js · demoDataset.js
└── styles/       global.css (tokens) · components.css · pages.css
```

## Tulu Lipi mapping for the backend

`public/tulu_lipi_map.json` is the same data as a plain JSON file, for the
Python side to import. It carries, for every letter, the Tulu Lipi character,
its `U+` codepoint, its official Unicode name, the roman reading and the
Kannada counterpart — plus the vowel signs and marks (anusvara, visarga,
virama) needed to transliterate whole words rather than single letters.

`KANNADA_TO_LIPI` in `src/data/tuluLipi.js` is the same table as a lookup
object, so the corpus (which is stored in Kannada script) can be rendered in
Tulu Lipi. Note that short `e` and short `o` and their vowel signs have no
target character, so a transliterator must decide what to do with them.
