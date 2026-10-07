/* ==========================================================================
   Mock mode — active only when VITE_API_URL is not set.
   Nothing outside services/ imports this file, so pointing the app at the
   real Python backend removes it from the running app entirely.

   Everything here is served from ../data/demoDataset.js. It exists so the
   interface can be demonstrated without the Flask backend running. It is
   sample data, not the output of a trained ASR or TTS model.
   ========================================================================== */

import { LESSON_CATEGORIES } from "../data/tulu";
import { DEMO_CORPUS, DEMO_PHRASES } from "../data/demoDataset";
import { respond, searchDictionary, browseDictionary, DICTIONARY_SIZE } from "./demoBrain";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const norm = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/[?!.,;:"'()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/* --- Phrase matching used by both chat and translate -------------------- */
function matchPhrase(text, sourceField) {
  const t = norm(text);
  if (!t) return null;
  const exact = DEMO_PHRASES.find((p) => norm(p[sourceField]) === t);
  if (exact) return exact;
  return (
    DEMO_PHRASES.find(
      (p) => t.includes(norm(p[sourceField])) || norm(p[sourceField]).includes(t)
    ) ?? null
  );
}

/* Chat is answered by the offline demo brain, which works from the project's
   Tulu data and keeps a small per-chat memory (see ./demoBrain.js). */
export async function chat(text, language = "tulu", context = {}) {
  // Longer answers take a touch longer, so the pause feels natural.
  const [corpus] = await Promise.all([loadCorpus(), wait(450 + Math.random() * 450)]);
  const reply = respond(text, language, context.memory || {});

  // A word the word list doesn't have may still be in the corpus.
  if (reply.lookup && KANNADA_RE.test(reply.lookup)) {
    const real = corpusEntry(corpus, reply.lookup);
    if (real) {
      reply.text = `**${bare(reply.lookup)}** appears ${real.frequency.toLocaleString()} times in the Tulu corpus, but its English meaning isn't in the word list yet.`;
      reply.blocks = [{ type: "word", word: bare(reply.lookup), roman: null, english: "", frequency: real.frequency, examples: real.examples }];
      reply.link = { to: "/dictionary", label: "Search it in the Dictionary" };
    }
  }
  // Real corpus counts and sentences instead of the demo's illustrative ones.
  reply.blocks = (reply.blocks || []).map((b) => {
    if (b.type !== "word" || b.word.includes(" ")) return b;
    const real = corpusEntry(corpus, b.word);
    return real
      ? { ...b, frequency: real.frequency, examples: real.examples.length ? real.examples : b.examples, corpusLabel: "Tulu Wikipedia corpus" }
      : { ...b, frequency: null };
  });
  return { audioUrl: null, ...reply };
}

export async function asr(_blob, language = "tulu") {
  await wait(1100);
  const item = pick(LESSON_CATEGORIES.flatMap((c) => c.items));
  return { text: language === "english" ? item.english : item.tulu };
}

/* ---------------------------------------------------------------- corpus
   A compact index of the cleaned Tulu Wikipedia corpus (73,872 sentences):
   real counts for the 15,000 most frequent words, and short real example
   sentences for the commonest ones. Loaded on first use, and only in demo
   mode — with a backend connected, the backend searches the full corpus. */
let corpusPromise = null;
const loadCorpus = () =>
  (corpusPromise ??= import("../data/corpusIndex.json").then((m) => m.default));
const KANNADA_RE = /[\u0C80-\u0CFF]/;
const bare = (s) => (s || "").trim().replace(/[\u200c\u200d]/g, "").replace(/[?!.,;:"'()]/g, "");

function corpusEntry(corpus, word) {
  const v = corpus.words[bare(word)];
  if (v == null) return null;
  return Array.isArray(v)
    ? { frequency: v[0], examples: v[1].map((i) => corpus.examples[i]) }
    : { frequency: v, examples: [] };
}

/* Replace the demo data's illustrative numbers with the corpus's real ones. */
function withCorpus(card, corpus) {
  if (!card || card.word.includes(" ")) return card;
  const real = corpusEntry(corpus, card.word);
  const sources = card.sources.filter((s) => s !== "Demo corpus");
  if (!real) return { ...card, frequency: null, sources };
  return {
    ...card,
    frequency: real.frequency,
    examples: real.examples.length ? real.examples : card.examples,
    sources: [...sources, "Tulu Wikipedia corpus"],
  };
}

function corpusOnlyCard(corpus, word) {
  const real = corpusEntry(corpus, word);
  if (!real) return null;
  return {
    word: bare(word), roman: null, english: null, meanings: [], kannada: [],
    frequency: real.frequency, examples: real.examples, usedIn: [],
    sources: ["Tulu Wikipedia corpus"], matchedBy: "Tulu", composed: false,
  };
}

/* Other corpus words that start with this one — mostly inflected forms. */
function corpusForms(corpus, word, limit = 6) {
  const p = bare(word);
  if (p.length < 2) return [];
  const out = [];
  for (const [w, v] of Object.entries(corpus.words)) {
    if (w !== p && w.startsWith(p)) out.push([w, Array.isArray(v) ? v[0] : v]);
  }
  return out.sort((a, b) => b[1] - a[1]).slice(0, limit);
}

/* Dictionary search runs over every Tulu entry the project has — lessons,
   phrasebook, numbers — by Tulu, English or Kannada, plus the corpus for
   any Kannada-script word. */
export async function dictionary(word) {
  const [corpus] = await Promise.all([loadCorpus(), wait(250)]);
  const r = searchDictionary(word);
  let card = withCorpus(r.best, corpus);
  let fuzzy = r.fuzzy;
  const isKn = KANNADA_RE.test(word || "");
  if (isKn && (!card || !["Tulu", "Kannada"].includes(card.matchedBy))) {
    const only = corpusOnlyCard(corpus, word);
    if (only) {
      card = only;
      fuzzy = false;
    }
  }
  const related = r.related.filter((x) => !card || x.tulu !== card.word);
  if (isKn) {
    for (const [w, n] of corpusForms(corpus, word)) {
      if (related.length >= 10) break;
      related.push({ tulu: w, roman: null, english: `${n.toLocaleString()} in corpus`, matchedBy: "Corpus form" });
    }
  }
  return {
    word: card?.word ?? (word || "").trim(),
    frequency: card?.frequency ?? 0,
    examples: card?.examples ?? [],
    roman: card?.roman ?? null,
    english: card?.english ?? null,
    found: !!card,
    card,
    fuzzy,
    related,
    sentences: [],
    total: r.total,
  };
}

export const dictionaryIndex = () => ({ size: DICTIONARY_SIZE, groups: browseDictionary() });

export async function translate(text, pair) {
  await wait(750);
  const phrase = matchPhrase(text, pair.source);
  if (phrase) {
    return pair.target === "tulu"
      ? { text: phrase.tulu, roman: phrase.roman }
      : { text: phrase[pair.target], roman: null };
  }
  return {
    text:
      pair.target === "tulu"
        ? "ಈ ವಾಕ್ಯ ಡೆಮೊ ಡೇಟಾಸೆಟ್‌ಡ್ ಇಜ್ಜಿ."
        : "This phrase is not in the demo dataset.",
    roman: pair.target === "tulu" ? "ee vaakya demo dataset-d ijji." : null,
  };
}

export async function tts() {
  await wait(400);
  return { audioUrl: null };
}

export async function uploadVoice() {
  await wait(1500);
  return { ok: true, id: "demo-sample" };
}

/* Demo mode has no server voice, so personalisation can't run. */
export async function voiceStatus() {
  await wait(200);
  return {
    ready: false,
    demo: true,
    message:
      "Demo mode: the sample stays in this browser. Connect the backend (VITE_API_URL) to hear answers in your voice.",
  };
}

/* Demo mode keeps reports in this browser so the form can be tried out;
   with the backend connected they go to the Admin page instead. */
export async function sendFeedback(report) {
  await wait(500);
  try {
    const key = "tulumitra:feedback:demo";
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    list.unshift({ ...report, created: Date.now() });
    localStorage.setItem(key, JSON.stringify(list.slice(0, 100)));
  } catch {
    /* storage blocked */
  }
  return { ok: true, demo: true };
}
