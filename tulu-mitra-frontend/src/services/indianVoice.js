/* ==========================================================================
   Indian voice for the browser fallback.

   When no speech model is connected, the play button uses the voices built
   into the viewer's browser and operating system. A voice can only read the
   script of its own language, so text in Kannada script (how Tulu is
   written) handed to an English voice comes out garbled or silent — and the
   default voice on most computers is American English.

   So the text is fitted to the best Indian voice available:
     1. a Kannada voice          → reads the Kannada script as written
     2. a Telugu voice           → Kannada converted letter-for-letter into Telugu
                                   script (the two scripts match almost exactly,
                                   and Telugu keeps final vowels, as Tulu does)
     3. a Hindi / Marathi voice  → converted into Devanagari
     4. an Indian-English voice  → a simple Latin-letter spelling
     5. anything else            → the same Latin spelling, never raw Kannada script

   The viewer can also pick a voice in the Voice menu; that choice is kept in
   this browser. Microsoft Edge ships natural Kannada voices; Chrome ships a
   Hindi one. This is still the computer's voice, not the project's TTS model.
   ========================================================================== */

const KANNADA = /[ಀ-೿]/;
const PREF_KEY = "tulumitra:voice";

/* ---------------------------------------------------- script conversion */

/* Kannada and Devanagari/Telugu share the same Unicode layout (both come
   from ISCII), so most letters convert with a fixed offset. The few that
   don't have a direct twin are listed. */
const TO_DEVANAGARI_SPECIAL = {
  "ಎ": "ए", // ಎ short e → ए
  "ಒ": "ओ", // ಒ short o → ओ
  "ೆ": "े", // ೆ → े
  "ೊ": "ो", // ೊ → ो
  "ೞ": "ळ", // ೞ → ळ
};
const TO_TELUGU_SPECIAL = {
  "ೞ": "ళ", // ೞ → ళ
};

function convert(text, offset, special) {
  let out = "";
  for (const ch of text || "") {
    const cp = ch.codePointAt(0);
    if (special[ch]) out += special[ch];
    else if (cp >= 0x0c80 && cp <= 0x0cff) out += String.fromCodePoint(cp - offset);
    else out += ch;
  }
  return out;
}

export const toDevanagari = (t) => convert(t, 0x380, TO_DEVANAGARI_SPECIAL);
export const toTelugu = (t) => convert(t, 0x80, TO_TELUGU_SPECIAL);

/* A plain Latin spelling an English voice can read: ನೀರ್ → "neer". */
const VOWELS = {
  "ಅ": "a", "ಆ": "aa", "ಇ": "i", "ಈ": "ee", "ಉ": "u", "ಊ": "oo", "ಋ": "ru", "ೠ": "roo",
  "ಎ": "e", "ಏ": "ae", "ಐ": "ai", "ಒ": "o", "ಓ": "o", "ಔ": "au",
};
const SIGNS = {
  "ಾ": "aa", "ಿ": "i", "ೀ": "ee", "ು": "u", "ೂ": "oo", "ೃ": "ru", "ೄ": "roo",
  "ೆ": "e", "ೇ": "ae", "ೈ": "ai", "ೊ": "o", "ೋ": "o", "ೌ": "au",
};
const CONSONANTS = {
  "ಕ": "k", "ಖ": "kh", "ಗ": "g", "ಘ": "gh", "ಙ": "ng",
  "ಚ": "ch", "ಛ": "chh", "ಜ": "j", "ಝ": "jh", "ಞ": "ny",
  "ಟ": "t", "ಠ": "th", "ಡ": "d", "ಢ": "dh", "ಣ": "n",
  "ತ": "t", "ಥ": "th", "ದ": "d", "ಧ": "dh", "ನ": "n",
  "ಪ": "p", "ಫ": "ph", "ಬ": "b", "ಭ": "bh", "ಮ": "m",
  "ಯ": "y", "ರ": "r", "ಱ": "r", "ಲ": "l", "ವ": "v", "ಶ": "sh", "ಷ": "sh", "ಸ": "s",
  "ಹ": "h", "ಳ": "l", "ೞ": "zh",
};
const DIGITS = "೦೧೨೩೪೫೬೭೮೯";

export function toLatin(text) {
  const chars = [...(text || "").replace(/[‌‍]/g, "")];
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const next = chars[i + 1];
    if (CONSONANTS[c]) {
      out += CONSONANTS[c];
      if (next === "್") i++; // virama: no vowel
      else if (SIGNS[next]) {
        out += SIGNS[next];
        i++;
      } else out += "a"; // inherent vowel
    } else if (VOWELS[c]) out += VOWELS[c];
    else if (c === "ಂ") out += !next || /[\sಪಫಬಭಮ]/.test(next) ? "m" : "n"; // ಂ: m before p/b/m, else n
    else if (c === "ಃ") out += "h";
    else if (DIGITS.includes(c)) out += String(DIGITS.indexOf(c));
    else if (!KANNADA.test(c)) out += c;
  }
  return out;
}

/* ------------------------------------------------------------- voices */

export function loadVoices(timeout = 1500) {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  if (!synth) return Promise.resolve([]);
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((done) => {
    const finish = () => done(synth.getVoices());
    synth.addEventListener?.("voiceschanged", finish, { once: true });
    setTimeout(finish, timeout);
  });
}

/* What kind of Indian voice this is, if any. */
export function voiceKind(v) {
  const lang = (v?.lang || "").toLowerCase();
  if (lang.startsWith("kn")) return "kannada";
  if (lang.startsWith("te")) return "telugu";
  if (lang.startsWith("hi") || lang.startsWith("mr")) return "hindi";
  if (lang === "en-in" || lang === "en_in") return "indian-english";
  return null;
}

export const KIND_LABEL = {
  kannada: "Kannada · reads the text as written",
  telugu: "Telugu · text converted to Telugu script",
  hindi: "Hindi / Marathi · text converted to Devanagari",
  "indian-english": "Indian English · reads a Latin spelling",
};

const RANK = { kannada: 4, telugu: 3, hindi: 2, "indian-english": 1 };

/* Indian voices on this computer, best first. */
export async function indianVoices() {
  const voices = await loadVoices();
  const quality = (v) => (/natural|neural|online|google/i.test(v.name) ? 1 : 0);
  return voices
    .filter((v) => voiceKind(v))
    .sort((a, b) => RANK[voiceKind(b)] - RANK[voiceKind(a)] || quality(b) - quality(a));
}

/* The Voice menu's choice, kept in this browser:
     ""          Automatic — the server's voice if it makes audio, else the
                 best Indian voice on this computer
     "server"    the server's Tulu Mitra voice
     "personal"  the server's voice converted to your uploaded sample
     anything else: the voiceURI of one of this computer's voices          */
export const SERVER_VOICE = "server";
export const PERSONAL_VOICE = "personal";
let memoryPref = null; // used when storage is blocked

export function getPreferredVoice() {
  try {
    return localStorage.getItem(PREF_KEY) || "";
  } catch {
    return memoryPref || "";
  }
}

export function setPreferredVoice(uri) {
  memoryPref = uri || "";
  try {
    if (uri) localStorage.setItem(PREF_KEY, uri);
    else localStorage.removeItem(PREF_KEY);
  } catch {
    /* storage blocked — the choice lasts until the page closes */
  }
  window.dispatchEvent(new CustomEvent("tulumitra:voice", { detail: uri || "" }));
}

/* Which path a play button should take for the current choice. */
export function voiceMode(pref = getPreferredVoice()) {
  if (!pref) return { mode: "auto", uri: "" };
  if (pref === SERVER_VOICE) return { mode: "server", uri: "" };
  if (pref === PERSONAL_VOICE) return { mode: "personal", uri: "" };
  return { mode: "browser", uri: pref };
}

/* The text as a given voice can read it. */
export function textFor(voice, text) {
  if (!KANNADA.test(text || "")) return text;
  switch (voiceKind(voice)) {
    case "kannada":
      return text;
    case "telugu":
      return toTelugu(text);
    case "hindi":
      return toDevanagari(text);
    default:
      return toLatin(text);
  }
}

/**
 * Pick the voice and the version of the text it should read.
 * Returns { voice, text, lang, kind } — voice may be null (browser default).
 */
export async function planSpeech(text, voiceURI = voiceMode().uri) {
  const all = await loadVoices();
  if (!KANNADA.test(text || "")) {
    const en = all.find((v) => voiceKind(v) === "indian-english") || all.find((v) => /^en-gb/i.test(v.lang)) || null;
    return { voice: en, text, lang: en?.lang || "en-IN", kind: en ? "english" : "default" };
  }
  const indian = await indianVoices();
  const chosen = (voiceURI && indian.find((v) => v.voiceURI === voiceURI)) || indian[0] || null;
  if (chosen) return { voice: chosen, text: textFor(chosen, text), lang: chosen.lang, kind: voiceKind(chosen) };
  return { voice: null, text: toLatin(text), lang: "en-IN", kind: "latin" };
}

/* --------------------------------------------------------------- speak
   Chrome has three habits that cut speech off part-way:
   • it can garbage-collect an utterance while it is still speaking,
   • its online Google voices stop after about 15 seconds,
   • cancel() immediately followed by speak() can clip the new speech.
   So speech is split into short chunks, every chunk is kept referenced
   until it finishes, long online speech is nudged every 10 seconds, and
   speaking starts a moment after any cancel.                            */

const live = { utterances: [], keepAlive: null, startTimer: null, token: 0 };

function chunk(text, max = 140) {
  const parts = String(text).split(/(?<=[.!?।,;:])\s+/).filter(Boolean);
  const out = [];
  for (const part of parts) {
    if (part.length <= max) {
      if (out.length && (out[out.length - 1] + " " + part).length <= max) out[out.length - 1] += " " + part;
      else out.push(part);
      continue;
    }
    let cur = "";
    for (const word of part.split(/\s+/)) {
      if ((cur + " " + word).trim().length > max && cur) {
        out.push(cur);
        cur = word;
      } else cur = (cur + " " + word).trim();
    }
    if (cur) out.push(cur);
  }
  return out.length ? out : [String(text)];
}

export function stopSpeaking() {
  live.token += 1;
  clearInterval(live.keepAlive);
  clearTimeout(live.startTimer);
  live.utterances = [];
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* nothing to stop */
  }
}

/**
 * Speak Kannada-script (or English) text with the best Indian voice.
 * Calls onEnd once, when everything has been spoken, stopped, or failed.
 * Returns the plan used ({ voice, kind }).
 */
export async function speak(text, { onEnd, voiceURI, rate } = {}) {
  const synth = window.speechSynthesis;
  if (!synth || !text) {
    onEnd?.();
    return null;
  }
  const busy = synth.speaking || synth.pending;
  stopSpeaking();
  const token = live.token;
  const plan = await planSpeech(text, voiceURI);
  if (token !== live.token) return plan; // stopped while choosing

  let ended = false;
  const finish = () => {
    if (ended || token !== live.token) return;
    ended = true;
    clearInterval(live.keepAlive);
    live.utterances = [];
    onEnd?.();
  };

  const pieces = chunk(plan.text);
  live.utterances = pieces.map((piece, i) => {
    const u = new SpeechSynthesisUtterance(piece);
    try {
      if (plan.voice) u.voice = plan.voice;
    } catch {
      /* voice rejected — the browser's default is used */
    }
    u.lang = plan.lang;
    u.rate = rate ?? (plan.kind === "kannada" ? 0.92 : 0.85);
    if (i === pieces.length - 1) u.onend = finish;
    u.onerror = (e) => {
      if (e?.error !== "interrupted" && e?.error !== "canceled") finish();
    };
    return u;
  });

  const start = () => {
    if (token !== live.token) return;
    live.utterances.forEach((u) => synth.speak(u));
    if (plan.voice && plan.voice.localService === false) {
      live.keepAlive = setInterval(() => {
        if (!synth.speaking) return clearInterval(live.keepAlive);
        synth.pause();
        synth.resume();
      }, 10000);
    }
  };
  // A short gap after cancel() stops Chrome from clipping the new speech.
  live.startTimer = setTimeout(start, busy ? 120 : 30);
  return plan;
}
