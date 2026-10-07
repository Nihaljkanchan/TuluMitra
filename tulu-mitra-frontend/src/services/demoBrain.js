/* ==========================================================================
   DEMO BRAIN — the offline conversation engine used in mock mode.

   WHAT THIS IS: a rule-based assistant that answers from the Tulu data
   already in this project — the lesson phrases, the demo corpus, numbers
   1–100, Tulu Lipi and the Kannada script. It keeps a small memory per
   chat (your name, a running quiz, which lesson you are on) so a
   conversation can actually go somewhere.

   WHAT THIS IS NOT: a language model. It does not generate new Tulu. Every
   Tulu word it shows comes from the project's data files; when it does not
   know something it says so instead of guessing. When VITE_API_URL is set,
   /chat goes to the real backend and this file is not used at all.
   ========================================================================== */

import { LESSON_CATEGORIES } from "../data/tulu";
import { DEMO_CORPUS, DEMO_PHRASES } from "../data/demoDataset";
import { numberWord } from "../data/learnExtras";
import { SCRIPT_GROUPS } from "../data/learnExtras";
import { LIPI_GROUPS } from "../data/tuluLipi";
import { KANNADA_GLOSS, KANNADA_NUMBERS } from "../data/kannadaGloss";

/* ------------------------------------------------------------------ utils */

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const norm = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/[\u200c\u200d]/g, "")
    .replace(/[’‘`']/g, "")
    .replace(/[?!.,;:"“”()[\]{}]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* Strip diacritics so "ta" can find both ta and ṭa. */
const fold = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const squash = (s) => norm(s).replace(/\s|'/g, "");

const KANNADA = /[ಀ-೿]/;

function distance(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/* --------------------------------------------------------- number words */

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen"];
const TENS_EN = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

const englishNumber = (n) => {
  if (n === 100) return "one hundred";
  if (n < 20) return ONES[n];
  const t = TENS_EN[Math.floor(n / 10)];
  return n % 10 ? `${t} ${ONES[n % 10]}` : t;
};

const NUMBER_BY_NAME = {};
for (let n = 1; n <= 100; n++) NUMBER_BY_NAME[englishNumber(n)] = n;
NUMBER_BY_NAME.hundred = 100;

function readNumber(s) {
  const t = norm(s);
  if (/^\d+$/.test(t)) return Number(t);
  if (NUMBER_BY_NAME[t]) return NUMBER_BY_NAME[t];
  return null;
}

/* ------------------------------------------------------------ the lexicon
   One merged list of every Tulu word or phrase the project knows, from
   every data file, so any question can reach any of it.                  */

const tuluKey = (s) => norm(s).replace(/\s/g, "");

const LEXICON = [];
const byTulu = new Map();

function addEntry({ tulu, roman, english = [], ...rest }) {
  const key = tuluKey(tulu);
  const alts = english
    .flatMap((e) => String(e).split("/"))
    .map((e) => norm(e).replace(/^(the|a|an|to) /, ""))
    .filter(Boolean);
  const existing = byTulu.get(key);
  if (existing) {
    for (const a of alts) if (!existing.alts.includes(a)) existing.alts.push(a);
    Object.assign(existing, { ...rest, ...existing });
    return existing;
  }
  const entry = {
    tulu: tulu.trim(),
    roman,
    english: cap(String(english[0] ?? "").split("/")[0].trim().replace(/\.$/, "")),
    alts,
    ...rest,
  };
  LEXICON.push(entry);
  byTulu.set(key, entry);
  return entry;
}

for (const c of LESSON_CATEGORIES) {
  for (const item of c.items) {
    addEntry({ tulu: item.tulu, roman: item.roman, english: [item.english], category: c.id });
  }
}
for (const p of DEMO_PHRASES) {
  addEntry({ tulu: p.tulu, roman: p.roman, english: [p.english], kannada: p.kannada, phrasebook: true });
}
for (const [word, e] of Object.entries(DEMO_CORPUS)) {
  addEntry({ tulu: word, roman: e.roman, english: [e.english], corpus: { word, ...e } });
}
for (let n = 1; n <= 100; n++) {
  const w = numberWord(n);
  addEntry({
    tulu: w.tulu,
    roman: w.roman,
    english: [String(n), englishNumber(n)],
    number: n,
    composed: w.composed,
  });
}

/* A few everyday English words that should reach an existing entry. */
const ALIASES = {
  "ಸೊಲ್ಮೆಲು": ["hello", "hi", "namaskara", "namaste", "greeting"],
  "ನುಪ್ಪು": ["rice"],
  "ಕುಲ್ಲುಲೆ": ["sit", "sit down"],
  "ದಯ ಮಲ್ತ್‌ದ್": ["please"],
};
for (const [tulu, extra] of Object.entries(ALIASES)) {
  const e = byTulu.get(tuluKey(tulu));
  if (e) for (const a of extra) if (!e.alts.includes(a)) e.alts.push(a);
}

/* Kannada equivalents, so every entry can be reached from Kannada too. */
for (const e of LEXICON) {
  const set = [];
  const add = (k) => k && !set.some((x) => tuluKey(x) === tuluKey(k)) && set.push(k.replace(/[?]$/, "").trim());
  (KANNADA_GLOSS[e.tulu] ?? []).forEach(add);
  add(e.kannada);
  if (e.number && KANNADA_NUMBERS[e.number]) add(KANNADA_NUMBERS[e.number]);
  e.kannadaAlts = set;
}

const asItem = (e, note) => ({
  tulu: e.tulu,
  roman: e.roman,
  english: e.number ? `${e.number} (${englishNumber(e.number)})` : e.english,
  note: note ?? (e.composed ? "composed" : undefined),
});

/* Exact meaning match only. Loose matching would turn "I want water" into
   just "water" and present it as a translation, which it isn't. */
function findEnglish(query) {
  const q = norm(query).replace(/^(the|a|an|to) /, "");
  if (!q) return null;
  return LEXICON.find((e) => e.alts.includes(q)) ?? null;
}

function findTulu(query) {
  const raw = (query || "").trim();
  if (!raw) return null;
  const key = tuluKey(raw);
  const direct = byTulu.get(key);
  if (direct) return direct;
  const sq = squash(raw);
  const byRoman = LEXICON.find((e) => squash(e.roman) === sq);
  if (byRoman) return byRoman;
  if (!KANNADA.test(raw) && sq.length >= 4) {
    const close = LEXICON.find((e) => distance(squash(e.roman), sq) <= (sq.length >= 8 ? 2 : 1));
    if (close) return close;
  }
  if (KANNADA.test(raw)) {
    return LEXICON.find((e) => e.kannadaAlts?.some((k) => tuluKey(k) === key)) ?? null;
  }
  return null;
}

/* Every lexicon word that appears inside a free-form message. */
function spotWords(text) {
  const found = [];
  const seen = new Set();
  const t = ` ${norm(text)} `;
  for (const e of LEXICON) {
    if (e.number) continue;
    const hitTulu = KANNADA.test(text) && t.includes(` ${norm(e.tulu)} `);
    const hitRoman = e.roman && e.roman.length > 2 && t.includes(` ${norm(e.roman)} `);
    const hitEn = e.alts.some((a) => a.length > 2 && !a.includes(" ") && t.includes(` ${a} `));
    if ((hitTulu || hitRoman || hitEn) && !seen.has(e.tulu)) {
      seen.add(e.tulu);
      found.push(e);
    }
  }
  return found.slice(0, 6);
}

/* --------------------------------------------------------- reply helpers */

const tuluReply = (tulu, roman, english, extra = {}) => ({
  text: tulu,
  lang: "tulu",
  roman,
  english,
  ...extra,
});

const englishReply = (text, extra = {}) => ({ text, lang: "english", ...extra });

const STARTERS = [
  "Teach me greetings",
  "How do you say water in Tulu?",
  "Count from 1 to 10",
  "Quiz me",
  "Show Tulu Lipi vowels",
  "Tell me a story",
  "What is Tulu?",
];

const moreStarters = (exclude = []) =>
  shuffle(STARTERS.filter((s) => !exclude.includes(s))).slice(0, 3);

/* ------------------------------------------------------ conversation map
   Replies to things people actually say, keyed by the Tulu phrase they
   match — whichever language the person typed it in.                     */

function conversational(entry, mem) {
  const said = { type: "phrases", title: "What you said, in Tulu", items: [asItem(entry)] };
  const name = mem.name ? `, ${mem.name}` : "";
  switch (tuluKey(entry.tulu)) {
    case tuluKey("ಎಂಚ ಉಲ್ಲರ್?"):
      return tuluReply("ಎಂಕ್ ಎಡ್ಡೆ ಉಂಡು. ಈರೆಗ್ ಎಂಚ ಉಂಡು?", "enk edde undu. eereg encha undu?",
        `I am well. How are you${name}?`, {
          blocks: [said],
          suggestions: ["I am well", "Teach me greetings", "Quiz me"],
          topic: "Greetings",
        });
    case tuluKey("ಈರೆನ ಪುದರ್ ದಾದ?"):
      return tuluReply("ಎನ್ನ ಪುದರ್ ತುಳು ಮಿತ್ರ.", "enna pudar Tulu Mitra.", "My name is Tulu Mitra.", {
        blocks: [
          said,
          { type: "text", text: "Tell me yours — type **my name is …** and I'll show you how to say it in Tulu." },
        ],
        suggestions: ["My name is Nihal", "What can you do?", "Teach me greetings"],
        topic: "Greetings",
      });
    case tuluKey("ಎಂಕ್ ಎಡ್ಡೆ ಉಂಡು"):
      return tuluReply("ಎಡ್ಡೆ!", "edde!", `Good${name}! Glad you're well.`, {
        blocks: [said, { type: "text", text: "Shall we learn something new?" }],
        suggestions: ["Teach me food words", "Count from 1 to 10", "Quiz me"],
        topic: "Greetings",
      });
    case tuluKey("ಸೊಲ್ಮೆಲು"):
      return greeting(mem);
    case tuluKey("ಬೊಕ್ಕ ತಿಕ್ಕುಗ"):
      return goodbye(mem);
    case tuluKey("ಎಂಕ್ ಬಚ್ಚಿರೆ ಆಪುಂಡು"): {
      const food = LESSON_CATEGORIES.find((c) => c.id === "food");
      return englishReply("Then let's talk food — here are the words you'll need at the table.", {
        blocks: [said, { type: "phrases", title: "Food words", items: food.items.map((i) => asItem(findTulu(i.tulu) ?? i)) }],
        suggestions: ["Quiz me", "What does ನುಪ್ಪು mean?", "Teach me daily phrases"],
        topic: "Food",
      });
    }
    case tuluKey("ಎಂಕ್ ಒಂತೆ ನೀರ್ ಕೊರ್ಲೆ"):
      return englishReply("I can't pour you a glass, but I can give you the word — **ನೀರ್** (neer) is water.", {
        blocks: [said, wordBlock(findTulu("ನೀರ್"))],
        suggestions: ["Teach me food words", "What does ಮೀನ್ mean?", "Quiz me"],
        topic: "Food",
      });
    case tuluKey("ಎಂಕ್ ಗೊತ್ತಿಜ್ಜಿ"):
      return englishReply("That's alright — that's what I'm here for. Pick something to start with:", {
        blocks: [said],
        suggestions: ["Teach me greetings", "Count from 1 to 10", "What is Tulu?"],
        topic: "Chat",
      });
    case tuluKey("ದಾದ ಮಲ್ಪುಗ?"):
      return englishReply("Right now I'm chatting with you and helping you learn Tulu.", {
        blocks: [said],
        suggestions: ["Quiz me", "Teach me daily phrases", "Tell me a story"],
        topic: "Chat",
      });
    case tuluKey("ಒಲ್ಪ ಪೋಪುಗ?"):
      return englishReply("Nowhere — I live right here in your browser. Where are *you* going?", {
        blocks: [said],
        suggestions: ["Teach me commands", "What does ಪೋಲ mean?", "Quiz me"],
        topic: "Chat",
      });
    default:
      return null;
  }
}

function greeting(mem) {
  const name = mem.name ? ` ${mem.name}` : "";
  const variants = [
    tuluReply("ಸೊಲ್ಮೆಲು! ಎಂಕ್ ಎಡ್ಡೆ ಉಂಡು. ಈರೆಗ್ ಎಂಚ ಉಂಡು?", "solmelu! enk edde undu. eereg encha undu?",
      `Greetings${name}! I am well. How are you?`),
    tuluReply("ಸೊಲ್ಮೆಲು! ಈರೆನ ಪುದರ್ ದಾದ?", "solmelu! eerena pudar daada?", "Greetings! What is your name?"),
    tuluReply("ಸೊಲ್ಮೆಲು! ಎಂಚ ಉಲ್ಲರ್?", "solmelu! encha ullar?", `Greetings${name}! How are you?`),
  ];
  const v = mem.name ? pick([variants[0], variants[2]]) : pick(variants);
  return {
    ...v,
    blocks: [{ type: "text", text: "**ಸೊಲ್ಮೆಲು** (solmelu) is the everyday Tulu greeting — you can use it any time of day." }],
    suggestions: v.english.includes("name") ? ["My name is Abhishek", "What can you do?", "Quiz me"] : ["I am well", "What can you do?", "Teach me greetings"],
    topic: "Greetings",
  };
}

function goodbye(mem) {
  return tuluReply("ಬೊಕ್ಕ ತಿಕ್ಕುಗ!", "bokka tikkuga!", `See you again${mem.name ? `, ${mem.name}` : ""}!`, {
    blocks: [{ type: "text", text: "Come back any time — this chat stays in the sidebar so you can pick it up later." }],
    suggestions: ["Quiz me", "Teach me greetings"],
    topic: "Greetings",
  });
}

/* ----------------------------------------------------------- word cards */

function wordBlock(e) {
  if (!e) return null;
  return {
    type: "word",
    word: e.tulu,
    roman: e.roman,
    english: e.number ? `${e.number} (${englishNumber(e.number)})` : e.english,
    frequency: e.corpus?.frequency ?? null,
    examples: e.corpus?.examples ?? [],
    composed: e.composed,
  };
}

function meaningOf(query) {
  const e = findTulu(query) ?? findEnglish(query);
  if (!e) return null;
  const isTuluQuery = KANNADA.test(query) || squash(e.roman) === squash(query);
  const lead = isTuluQuery
    ? `**${e.tulu}** (${e.roman}) means **${e.number ? e.number : e.english.toLowerCase()}**.`
    : `“${cap(norm(query))}” in Tulu is **${e.tulu}** (${e.roman}).`;
  return englishReply(lead, {
    blocks: [wordBlock(e)].filter(Boolean),
    suggestions: [`Use ${e.roman.split(" ")[0]} in a sentence`, "Quiz me", "Another word"],
    topic: "Word meaning",
    focus: e.tulu,
  });
}

/* -------------------------------------------------------- translations */

function translateToTulu(phrase) {
  const n = readNumber(phrase);
  if (n) return numberReply(n);

  const e = findEnglish(phrase) ?? findTulu(phrase);
  if (e) {
    return tuluReply(e.tulu, e.roman, e.number ? `${e.number}` : e.english, {
      blocks: [
        { type: "text", text: `That's how you say “${cap(norm(phrase))}” in Tulu. Tap play to hear it.` },
        ...(e.corpus ? [wordBlock(e)] : []),
      ],
      suggestions: ["Quiz me", `What does ${e.tulu} mean?`, "Translate something else"],
      topic: "Translation",
      focus: e.tulu,
    });
  }

  // Not a known phrase: offer a word-by-word gloss of the words we do know.
  const words = norm(phrase).split(" ");
  const gloss = [];
  for (const w of words) {
    const hit = LEXICON.find((x) => !x.number && x.alts.includes(w));
    if (hit && !gloss.includes(hit)) gloss.push(hit);
  }
  if (gloss.length) {
    return englishReply(
      `I don't have “${phrase.trim()}” as a whole sentence, but I know some of its words:`,
      {
        blocks: [
          { type: "phrases", title: "Word by word", items: gloss.map((g) => asItem(g)) },
          { type: "note", text: "This is a word-by-word gloss, not a sentence translation — Tulu word order and endings differ from English." },
        ],
        suggestions: ["How do you say how are you in Tulu?", "Teach me daily phrases", "Quiz me"],
        topic: "Translation",
      }
    );
  }
  return null;
}

/* -------------------------------------------------------------- numbers */

function numberReply(n) {
  if (n < 1 || n > 100) {
    return englishReply(`I know the Tulu numbers from 1 to 100 — ${n} is outside that range for now.`, {
      suggestions: ["Count from 1 to 10", "What is 100 in Tulu?", "Quiz me"],
      topic: "Numbers",
    });
  }
  const w = numberWord(n);
  return tuluReply(w.tulu, w.roman, `${n} — ${englishNumber(n)}`, {
    blocks: w.composed
      ? [{ type: "note", text: "Written as the tens word plus the unit word. Spoken Tulu often runs the two together, and the fused form varies by region." }]
      : [],
    suggestions: [`What is ${Math.min(100, n + 1)} in Tulu?`, `Count from ${n} to ${Math.min(100, n + 9)}`, "Quiz me on numbers"],
    topic: "Numbers",
    focus: w.tulu,
  });
}

function countReply(from, to) {
  from = Math.max(1, Math.min(100, from));
  to = Math.max(from, Math.min(100, to));
  const end = Math.min(to, from + 19);
  const items = [];
  for (let n = from; n <= end; n++) {
    const w = numberWord(n);
    items.push({ tulu: w.tulu, roman: w.roman, english: String(n), note: w.composed ? "composed" : undefined });
  }
  const more = end < 100;
  return englishReply(
    end < to
      ? `Here are ${from} to ${end} — I'll show twenty at a time.`
      : `Counting from ${from} to ${end} in Tulu:`,
    {
      blocks: [
        { type: "phrases", title: `${from}–${end}`, items, numbered: true },
        ...(items.some((i) => i.note) ? [{ type: "note", text: "“composed” numbers are written as tens word + unit word; the spoken, fused form varies by region." }] : []),
      ],
      suggestions: [
        ...(more ? [`Count from ${end + 1} to ${Math.min(100, end + 10)}`] : []),
        "Quiz me on numbers",
        "What is 50 in Tulu?",
      ],
      topic: "Numbers",
    }
  );
}

/* ------------------------------------------------------------ Tulu Lipi */

const LIPI_LETTERS = LIPI_GROUPS.flatMap((g) => g.letters.map((l) => ({ ...l, group: g.label })));

function lipiReply(t, raw) {
  // A particular letter? Quoted first, then Kannada letters, then roman tokens.
  const quoted = raw.match(/["'“‘]([^"'”’]{1,4})["'”’]/)?.[1];
  const kn = [...raw.replace(/ತುಳು|ಲಿಪಿ|ಅಕ್ಷರ/g, "")].filter((c) => /[ಅ-ಹೞಱ]/.test(c));
  const stop = new Set(["a", "i", "in", "is", "it", "the", "how", "do", "you", "write", "tulu", "lipi",
    "letter", "letters", "what", "show", "me", "script", "tigalari", "of", "for", "say", "to", "and",
    "all", "vowels", "vowel", "consonants", "consonant", "varga", "chart", "alphabet", "written", "look", "does", "like"]);
  let letters = [];
  const wantsGroup = /varga|vowel|consonant|letters|alphabet|chart|other|additional/.test(t);
  if (quoted) letters = LIPI_LETTERS.filter((l) => fold(l.roman) === fold(quoted) || l.kannada === quoted);
  if (!letters.length && kn.length) letters = LIPI_LETTERS.filter((l) => kn.includes(l.kannada));
  if (!letters.length && !wantsGroup) {
    const tokens = t.split(" ").filter((w) => !stop.has(w));
    letters = LIPI_LETTERS.filter((l) => tokens.some((w) => fold(l.roman) === fold(w)));
  }
  if (letters.length && letters.length <= 6) {
    const unencoded = letters.filter((l) => !l.lipi);
    return englishReply(
      letters.length === 1
        ? `Here is **${letters[0].roman}** in Tulu Lipi — the same sound as Kannada **${letters[0].kannada}**.`
        : `A few Tulu Lipi letters match that — here they are side by side:`,
      {
        blocks: [
          { type: "lipi", letters },
          ...(unencoded.length
            ? [{ type: "note", text: "Short e and short o are not in Unicode yet — only the long ē and ō are encoded — so they have no letter to show." }]
            : []),
        ],
        suggestions: ["Show Tulu Lipi vowels", "Show Ka-varga in Tulu Lipi", "What is Tulu Lipi?"],
        topic: "Tulu Lipi",
      }
    );
  }

  // A whole group?
  const groupAsked =
    /vowel|swara|ಸ್ವರ/.test(t) ? "vowels" :
    /\bka\b.*varga|ka varga|kavarga/.test(t) ? "ka" :
    /\bca\b.*varga|ca varga|cha varga/.test(t) ? "ca" :
    /ṭa varga|retroflex/.test(t) || /tta varga/.test(fold(t)) ? "tta" :
    /\bta\b.*varga|ta varga/.test(t) ? "ta" :
    /\bpa\b.*varga|pa varga/.test(t) ? "pa" :
    /other|remaining|ya ra la/.test(t) ? "other" :
    /extra|additional|special/.test(t) ? "extra" :
    /consonant|vyanjana|letters|alphabet|chart|all/.test(t) ? "ka" : null;

  if (groupAsked) {
    const idx = LIPI_GROUPS.findIndex((g) => g.id === groupAsked);
    const g = LIPI_GROUPS[idx];
    const next = LIPI_GROUPS[(idx + 1) % LIPI_GROUPS.length];
    return englishReply(`**${g.label}** in Tulu Lipi (${g.kn}) — tap any letter to hear its sound.`, {
      blocks: [{ type: "lipi", letters: g.letters }],
      suggestions: [`Show ${next.label} in Tulu Lipi`, "What is Tulu Lipi?", "Open the full chart in Learn"],
      topic: "Tulu Lipi",
    });
  }

  return englishReply(
    "**Tulu Lipi** — also called the Tulu-Tigalari script — is Tulu's own historic writing system. It was used for palm-leaf manuscripts in the Tulu-speaking coast, and was added to Unicode in version 16.0 (2024). Today most Tulu is written in the Kannada script instead.",
    {
      blocks: [
        { type: "lipi", letters: LIPI_GROUPS[0].letters.slice(0, 6) },
        { type: "note", text: "Few devices have a font for this script yet; where it's missing, each letter shows its Kannada counterpart and its Unicode codepoint." },
      ],
      suggestions: ["Show Tulu Lipi vowels", "Show Ka-varga in Tulu Lipi", "How do you write ma in Tulu Lipi?"],
      topic: "Tulu Lipi",
    }
  );
}

/* ------------------------------------------------------- Kannada script */

function kannadaScriptReply(t) {
  const g = /consonant|vyanjana/.test(t) ? SCRIPT_GROUPS[1] : SCRIPT_GROUPS[0];
  const other = g === SCRIPT_GROUPS[0] ? "Show Kannada consonants" : "Show Kannada vowels";
  return englishReply(`**${g.label}** of the Kannada script (${g.kn}) — the script Tulu is written in today.`, {
    blocks: [{ type: "letters", letters: g.letters }, { type: "text", text: g.note }],
    suggestions: [other, "What is Tulu Lipi?", "Quiz me"],
    topic: "Kannada script",
  });
}

/* -------------------------------------------------------------- lessons */

const LESSON_WORDS = {
  greetings: "greetings", greeting: "greetings", hello: "greetings",
  food: "food", eating: "food", kitchen: "food",
  daily: "daily", phrases: "daily", everyday: "daily", "daily phrases": "daily",
  commands: "commands", command: "commands", requests: "commands",
};

function lessonReply(index) {
  const c = LESSON_CATEGORIES[index % LESSON_CATEGORIES.length];
  const next = LESSON_CATEGORIES[(index + 1) % LESSON_CATEGORIES.length];
  return {
    ...englishReply(`**Lesson: ${c.label}** (${c.kn}). ${c.blurb} Play each one and say it back out loud.`, {
      blocks: [{ type: "phrases", items: c.items.map((i) => asItem(findTulu(i.tulu) ?? i)) }],
      suggestions: ["Quiz me on this", `Next lesson: ${next.label}`, "Tell me a story"],
      topic: `Lesson · ${c.label}`,
    }),
    memory: { lesson: index % LESSON_CATEGORIES.length },
  };
}

/* ----------------------------------------------------------------- quiz */

function quizPool(kind, lesson) {
  return rawPool(kind, lesson).filter((e) => !/my name is/i.test(e.english));
}

function rawPool(kind, lesson) {
  if (kind === "numbers") return LEXICON.filter((e) => e.number && e.number <= 20);
  if (lesson !== undefined && lesson !== null) {
    const c = LESSON_CATEGORIES[lesson];
    return c.items.map((i) => findTulu(i.tulu)).filter(Boolean);
  }
  return LEXICON.filter((e) => !e.number && e.english && e.roman && e.tulu.length < 26);
}

function askQuestion(quiz) {
  const pool = quizPool(quiz.kind, quiz.lesson).filter((e) => e.tulu !== quiz.answer?.tulu);
  const answer = pick(pool);
  const wrong = shuffle(pool.filter((e) => e !== answer && e.roman !== answer.roman)).slice(0, 2);
  const options = shuffle([answer, ...wrong]).map((e) => e.roman);
  const q = { ...quiz, answer: { tulu: answer.tulu, roman: answer.roman, english: answer.english, number: answer.number } };
  const en = answer.english.replace(/\.$/, "");
  const phrase = /^I\b/.test(en) ? en : en.charAt(0).toLowerCase() + en.slice(1);
  const prompt = answer.number
    ? `How do you say **${answer.number}** in Tulu?`
    : `How do you say **“${phrase}”** in Tulu?`;
  return { quiz: q, prompt, options };
}

function startQuiz(kind, lesson) {
  const { quiz, prompt, options } = askQuestion({ kind, lesson, asked: 0, score: 0 });
  const label = kind === "numbers" ? "numbers" : lesson !== undefined && lesson !== null ? LESSON_CATEGORIES[lesson].label.toLowerCase() : "Tulu words";
  return {
    ...englishReply(`Quiz time — ${label}! Answer in Latin letters or Kannada script, or tap an option.\n\n${prompt}`, {
      suggestions: [...options, "Hint", "Skip"],
      topic: "Quiz",
    }),
    memory: { quiz: { ...quiz, asked: 1 } },
  };
}

function quizTurn(text, mem) {
  const quiz = mem.quiz;
  const t = norm(text);
  const ans = quiz.answer;

  if (/^(stop|quit|end|exit|finish|enough|stop quiz|end quiz)( quiz)?$/.test(t)) {
    const answered = quiz.asked - 1;
    return {
      ...englishReply(
        `Quiz finished — you scored **${quiz.score} out of ${answered}**. ${quiz.score === answered && answered > 0 ? "Perfect! ಎಡ್ಡೆ!" : "Nice practice."}`,
        { blocks: [{ type: "phrases", title: "The last one was", items: [asItem(findTulu(ans.tulu) ?? ans)] }], suggestions: ["Quiz me again", "Teach me food words", "Tell me a story"], topic: "Quiz" }
      ),
      memory: { quiz: null },
    };
  }

  if (/^(hint|give me a hint|clue)$/.test(t)) {
    const hint = `${ans.roman.slice(0, Math.max(2, Math.ceil(ans.roman.length / 3)))}…`;
    return {
      ...englishReply(`Hint: it starts with **${hint}** (${ans.roman.split(" ").length} word${ans.roman.includes(" ") ? "s" : ""}).`, {
        suggestions: ["Skip", "Stop quiz"],
        topic: "Quiz",
      }),
      memory: { quiz },
    };
  }

  const skipped = /^(skip|pass|next|i dont know|dont know|no idea|reveal|show answer)$/.test(t);
  const guess = squash(text);
  const target = squash(ans.roman);
  const correct =
    !skipped &&
    (guess === target ||
      tuluKey(text) === tuluKey(ans.tulu) ||
      (target.length >= 4 && distance(guess, target) <= (target.length >= 9 ? 2 : 1)));

  const { quiz: nextQuiz, prompt, options } = askQuestion(quiz);
  const score = quiz.score + (correct ? 1 : 0);
  const asked = quiz.asked;
  const reveal = { type: "phrases", items: [asItem(findTulu(ans.tulu) ?? ans)] };

  const base = correct
    ? tuluReply("ಸರಿ!", "sari!", `Correct! That's ${score}/${asked}.`, { blocks: [reveal] })
    : englishReply(
        skipped
          ? `No problem — the answer is **${ans.tulu}** (${ans.roman}).`
          : `Not quite — it's **${ans.tulu}** (${ans.roman}). Score: ${score}/${asked}.`,
        { blocks: [reveal] }
      );

  return {
    ...base,
    blocks: [...base.blocks, { type: "text", text: `**Next:** ${prompt}` }],
    suggestions: [...options, "Hint", "Stop quiz"],
    topic: "Quiz",
    memory: { quiz: { ...nextQuiz, score, asked: asked + 1 } },
  };
}

/* --------------------------------------------------------------- stories */

const STORIES = [
  [
    "On a hot afternoon near Mangaluru, a boy came running home and called out to his grandmother: ",
    { tulu: "ಎಂಕ್ ಒಂತೆ ನೀರ್ ಕೊರ್ಲೆ", roman: "enk onte neer korle", english: "give me some water" },
    ". She laughed and said ",
    { tulu: "ಕುಲ್ಲುಲೆ", roman: "kullule", english: "please sit" },
    ", then set down a plate of ",
    { tulu: "ನುಪ್ಪು", roman: "nuppu", english: "rice" },
    " and ",
    { tulu: "ಮೀನ್", roman: "meen", english: "fish" },
    ". When he had eaten she asked ",
    { tulu: "ಎಂಚ ಉಲ್ಲರ್?", roman: "encha ullar?", english: "how are you?" },
    " — and he grinned: ",
    { tulu: "ಎಂಕ್ ಎಡ್ಡೆ ಉಂಡು", roman: "enk edde undu", english: "I am well" },
    ".",
  ],
  [
    "Two friends met at the market one morning. “",
    { tulu: "ಸೊಲ್ಮೆಲು", roman: "solmelu", english: "greetings" },
    "!” said the first. “",
    { tulu: "ಒಲ್ಪ ಪೋಪುಗ?", roman: "olpa popuga?", english: "where are you going?" },
    "” The second pointed at the jackfruit stall — ",
    { tulu: "ಪೆಲಕಾಯಿ", roman: "pelakaayi", english: "jackfruit" },
    " was in season. “",
    { tulu: "ಬಲ", roman: "bala", english: "come" },
    ",” he said, and they went together. At the end of the day they parted with ",
    { tulu: "ಬೊಕ್ಕ ತಿಕ್ಕುಗ", roman: "bokka tikkuga", english: "see you again" },
    ".",
  ],
  [
    "A new student arrived at a village school. The teacher smiled and asked, “",
    { tulu: "ಈರೆನ ಪುದರ್ ದಾದ?", roman: "eerena pudar daada?", english: "what is your name?" },
    "” The student was shy and whispered, “",
    { tulu: "ಎಂಕ್ ಗೊತ್ತಿಜ್ಜಿ", roman: "enk gottijji", english: "I don't know" },
    "” — everyone laughed, kindly. The teacher said “",
    { tulu: "ಸರಿ", roman: "sari", english: "alright" },
    "”, and gave her a snack of ",
    { tulu: "ಬಜಿಲ್", roman: "bajil", english: "beaten rice" },
    ". By lunch she was chatting like she'd always been there.",
  ],
];

function storyReply(mem) {
  const i = ((mem.story ?? -1) + 1) % STORIES.length;
  const parts = STORIES[i];
  const words = parts.filter((p) => typeof p === "object");
  return {
    ...englishReply("Here's a short story with Tulu woven in — tap any Tulu phrase to hear it.", {
      blocks: [
        { type: "story", parts },
        { type: "phrases", title: "Tulu from the story", items: words.map((w) => ({ tulu: w.tulu, roman: w.roman, english: cap(w.english) })) },
      ],
      suggestions: ["Another story", "Quiz me", "Teach me greetings"],
      topic: "Story",
    }),
    memory: { story: i },
  };
}

/* ----------------------------------------------------------- about Tulu */

const FACTS = {
  overview: {
    text: "**Tulu** (ತುಳು) is a Dravidian language spoken mainly along the south-western coast of India — the region known as **Tulu Nadu**. It is one of the five major Dravidian languages, alongside Kannada, Tamil, Telugu and Malayalam, and has a rich oral tradition of folk epics (*paddanas*), theatre and ritual performance.",
    suggestions: ["Where is Tulu spoken?", "How many people speak Tulu?", "What script is Tulu written in?"],
  },
  region: {
    text: "Tulu is spoken mainly in **Dakshina Kannada** and **Udupi** districts of Karnataka and **Kasaragod** district of Kerala — together called Tulu Nadu. Mangaluru and Udupi are its main cities, and there are large Tulu-speaking communities in Mumbai, Bengaluru and the Gulf.",
    suggestions: ["How many people speak Tulu?", "Tell me about Tulu culture", "Teach me greetings"],
  },
  speakers: {
    text: "The **2011 Census of India** counted about **18.5 lakh** (roughly 1.85 million) people who reported Tulu as their mother tongue. Community estimates are often higher, since many Tulu speakers also use Kannada or other languages day to day.",
    suggestions: ["Is Tulu an official language?", "Where is Tulu spoken?", "Quiz me"],
  },
  script: {
    text: "Today Tulu is mostly written in the **Kannada script**. Historically it had its own script, **Tulu Lipi** (Tulu-Tigalari), used in palm-leaf manuscripts; it was encoded in Unicode 16.0 in 2024, and there are ongoing efforts to revive it.",
    suggestions: ["What is Tulu Lipi?", "Show Tulu Lipi vowels", "Show Kannada vowels"],
  },
  family: {
    text: "Tulu belongs to the **Dravidian** language family, in the southern branch. It split off early from the other southern Dravidian languages, which is why it keeps several features of its own and is not mutually intelligible with Kannada, even though the two share a script and many borrowed words.",
    suggestions: ["What is Tulu?", "What script is Tulu written in?", "Teach me greetings"],
  },
  culture: {
    text: "Tulu Nadu is known for **Yakshagana** (a night-long dance-drama), **Bhuta Kola** (ritual worship of spirit deities, performed in Tulu), **Kambala** (buffalo racing in paddy fields), and a coastal cuisine of rice, fish, coconut and jackfruit.",
    suggestions: ["Teach me food words", "Tell me a story", "Where is Tulu spoken?"],
  },
  status: {
    text: "Tulu is **not** among the 22 languages in the Eighth Schedule of India's Constitution. There has been a long-running campaign by Tulu speakers to have it added, and to give it official-language status in Karnataka and Kerala.",
    suggestions: ["How many people speak Tulu?", "What is Tulu?", "Why build a Tulu assistant?"],
  },
  why: {
    text: "Tulu is a **low-resource language** — there is very little digital text or speech data for it compared with Kannada or Hindi, so most voice assistants and translation tools don't support it. Tulu Mitra is a step towards changing that: talking, learning and translating in Tulu, with Tulu speech in and out.",
    suggestions: ["How do you work?", "Who made you?", "Teach me greetings"],
  },
};

function factReply(key) {
  const f = FACTS[key];
  return englishReply(f.text, { suggestions: f.suggestions, topic: "About Tulu" });
}

/* ------------------------------------------------------- about the app */

function helpReply() {
  return englishReply("Here's what I can do — just ask in English, Kannada or Tulu:", {
    blocks: [
      {
        type: "bullets",
        items: [
          "**Chat** — say hello, tell me your name, ask how I am",
          "**Translate** — “How do you say *water* in Tulu?”",
          "**Word meanings** — “What does ನೀರ್ mean?”, with corpus examples",
          "**Numbers** — any number from 1 to 100, or “count from 1 to 20”",
          "**Lessons** — greetings, food, daily phrases, commands",
          "**Quizzes** — “Quiz me” and I'll keep score",
          "**Tulu Lipi & Kannada script** — letters, sounds and groups",
          "**Stories** and facts about the Tulu language",
        ],
      },
    ],
    suggestions: ["Quiz me", "Teach me greetings", "Tell me a story"],
    topic: "Help",
  });
}

function aboutProject() {
  return englishReply(
    "I'm **Tulu Mitra**, a major project by **Abhishek Nayak** and **Nihal**, Department of Artificial Intelligence and Machine Learning, **Canara Engineering College**.",
    {
      blocks: [
        {
          type: "bullets",
          items: [
            "**Voice in** — your speech goes to the ASR model (/asr) and comes back as text",
            "**Understanding** — the Python backend detects what you want and builds a reply (/chat)",
            "**Voice out** — replies are turned into Tulu speech (/tts), optionally in your own voice",
          ],
        },
        {
          type: "note",
          text: "Right now I'm running in demo mode: answers come from the project's built-in Tulu data, not the backend model, and audio uses your browser's voice.",
        },
      ],
      suggestions: ["What can you do?", "Why build a Tulu assistant?", "Quiz me"],
      topic: "About the project",
    }
  );
}

/* --------------------------------------------------------------- time */

function timeReply() {
  const now = new Date();
  const h12 = now.getHours() % 12 || 12;
  const w = numberWord(h12);
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
  return englishReply(`It's **${time}** on ${date}. The hour, ${h12}, is **${w.tulu}** (${w.roman}) in Tulu.`, {
    blocks: [{ type: "phrases", items: [{ tulu: w.tulu, roman: w.roman, english: String(h12) }] }],
    suggestions: ["Count from 1 to 12", "Quiz me on numbers", "What is 30 in Tulu?"],
    topic: "Numbers",
  });
}

/* ------------------------------------------------------------ fallback */

function fallback(text) {
  const spotted = spotWords(text);
  const opener = pick([
    "I don't have an answer to that in my Tulu data yet.",
    "That's outside what I know in demo mode, I'm afraid.",
    "I couldn't find that in my Tulu knowledge base.",
  ]);
  if (spotted.length) {
    return englishReply(`${opener} But I did recognise some words in your message:`, {
      blocks: [{ type: "phrases", items: spotted.map((e) => asItem(e)) }],
      suggestions: ["What can you do?", "Quiz me", "Teach me daily phrases"],
      topic: "Chat",
    });
  }
  return englishReply(`${opener} Try one of these, or ask “what can you do?”`, {
    blocks: [{ type: "note", text: "In demo mode I answer from the project's built-in Tulu data. Once the backend is connected, open questions go to the language model instead." }],
    suggestions: moreStarters(),
    topic: "Chat",
  });
}

/* ================================================================ route */

const GREET = /^(hi+|hello+|hey+|helo|hai|namaste|namaskara?|namaskaram|good (morning|afternoon|evening)|yo|hola|ಸೊಲ್ಮೆಲು|ನಮಸ್ಕಾರ|ನಮಸ್ತೆ)\b/;

function extract(t, patterns) {
  for (const p of patterns) {
    const m = t.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

/**
 * Answer one message.
 * @param {string} raw     what the person typed or said
 * @param {string} language "english" | "kannada" | "tulu"
 * @param {object} mem     this chat's memory (name, quiz, lesson, story)
 * @returns reply { text, lang, roman?, english?, blocks?, suggestions?, topic, memory }
 */
export function respond(raw, language = "english", mem = {}) {
  const r = route(raw, language, mem);
  const memory = { ...mem, ...(r.memory || {}) };
  const { memory: _m, ...shown } = r;
  memory.last = shown;
  // Any non-quiz answer ends a running quiz.
  if (mem.quiz && r.topic !== "Quiz") memory.quiz = null;
  return { blocks: [], suggestions: [], ...r, memory };
}

function route(raw, language, mem) {
  const text = (raw || "").trim();
  let t = norm(text);
  if (!t) return fallback(text);

  /* 1. A quiz in progress takes the next answer — unless it's plainly a new question. */
  const looksLikeQuestion = /^(what|how|who|why|where|when|tell|teach|translate|show|count|define|meaning|explain|can you|help)\b/.test(t) && t.split(" ").length > 2;
  if (mem.quiz && !looksLikeQuestion) return quizTurn(text, mem);

  /* 2. Strip a leading greeting if more follows ("hi, how do you say …"). */
  if (GREET.test(t)) {
    const rest = t.replace(GREET, "").replace(/^(there|tulu mitra|mitra|friend)\b/, "").trim();
    if (rest.split(" ").filter(Boolean).length < 2) return greeting(mem);
    t = rest;
  }

  /* 3. Names. */
  const name =
    extract(t, [/^(?:my name is|my names|call me|this is)\s+([a-z][a-z ]{0,24})$/, /^ಎನ್ನ ಪುದರ್\s+(.+)$/, /^ನನ್ನ ಹೆಸರು\s+(.+)$/]) ??
    extract(t, [/^(?:i am|im)\s+([a-z]{2,20})$/]);
  const notNames = /^(hungry|fine|good|ok|okay|well|great|tired|bored|sad|happy|here|back|ready|learning|new|confused|lost|sick|not|a|an|from|going|doing|done|sorry)$/;
  if (name && !notNames.test(name) && !findEnglish(`i am ${name}`)) {
    const display = name.replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      ...englishReply(`Nice to meet you, **${display}**! Here's how you'd introduce yourself in Tulu:`, {
        blocks: [
          { type: "phrases", items: [{ tulu: `ಎನ್ನ ಪುದರ್ ${display}`, roman: `enna pudar ${display}`, english: `My name is ${display}.` }] },
          { type: "text", text: "**ಎನ್ನ ಪುದರ್** (enna pudar) means “my name”. Now try asking mine: **ಈರೆನ ಪುದರ್ ದಾದ?**" },
        ],
        suggestions: ["ಈರೆನ ಪುದರ್ ದಾದ?", "Teach me greetings", "Quiz me"],
        topic: "Greetings",
      }),
      memory: { name: display },
    };
  }
  if (/^(what is my name|whats my name|do you remember my name|who am i)$/.test(t)) {
    return mem.name
      ? tuluReply(`ಈರೆನ ಪುದರ್ ${mem.name}.`, `eerena pudar ${mem.name}.`, `Your name is ${mem.name}.`, { suggestions: ["Quiz me", "Tell me a story"], topic: "Greetings" })
      : englishReply("You haven't told me yet! Type **my name is …**", { suggestions: ["My name is Abhishek", "My name is Nihal"], topic: "Greetings" });
  }

  /* 4. Small talk. */
  if (/\b(thank you|thanks|thank u|thx|ty|dhanyavada|dhanyavadagalu)\b|ಧನ್ಯವಾದ/.test(t)) {
    return englishReply(pick(["You're welcome! What shall we learn next?", "Happy to help — anything else?", "Any time! Want to keep going?"]), {
      suggestions: moreStarters(), topic: "Chat",
    });
  }
  if (/^(bye|goodbye|good bye|see you|see ya|good night|gn|ta ta|tata|ok bye)\b/.test(t)) return goodbye(mem);
  if (/^(ok|okay|k|cool|nice|great|awesome|good|wow|alright|hmm+|yes|yeah|yep|sure|fine)$/.test(t)) {
    return tuluReply("ಸರಿ!", "sari!", "Alright!", {
      blocks: [{ type: "text", text: "**ಸರಿ** (sari) is how Tulu speakers say “alright” or “correct”. What next?" }],
      suggestions: moreStarters(), topic: "Chat",
    });
  }
  if (/^(no|nope|nah|not now)$/.test(t)) {
    return englishReply("No problem. I'm here whenever you want to practise.", { suggestions: moreStarters(), topic: "Chat" });
  }
  if (/^(i am|im|i feel|feeling) (fine|good|ok|okay|well|great|happy)\b/.test(t)) {
    return conversational(findTulu("ಎಂಕ್ ಎಡ್ಡೆ ಉಂಡು"), mem);
  }
  if (/^(i am|im|i feel|feeling) (sad|tired|bored|sick|not well|stressed)\b/.test(t)) {
    return englishReply("Sorry to hear that. Maybe a short, easy story would be a nice break?", {
      suggestions: ["Tell me a story", "Teach me greetings", "What is Tulu?"], topic: "Chat",
    });
  }
  if (/^(repeat|say (it|that) again|again|once more|pardon)$/.test(t) && mem.last) {
    return { ...mem.last, memory: {} };
  }

  /* 5. Identity, help, project. */
  const asksToTranslate = /(^how (do|would|can|should) (you|i|we) say|^how to say|^translate|in tulu$|ತುಳುವಿನಲ್ಲಿ|ತುಳುವಲ್ಲಿ)/.test(t);
  if (!asksToTranslate && /(who are you|what are you|your name|who r u|introduce yourself|ನೀನು ಯಾರು|ನೀವು ಯಾರು|ನಿಮ್ಮ ಹೆಸರೇನು)/.test(t)) {
    return tuluReply("ಎನ್ನ ಪುದರ್ ತುಳು ಮಿತ್ರ.", "enna pudar Tulu Mitra.", "My name is Tulu Mitra.", {
      blocks: [{ type: "text", text: "*Mitra* means friend — I'm your companion for speaking, learning and translating Tulu." }],
      suggestions: ["What can you do?", "Who made you?", "My name is Abhishek"],
      topic: "Greetings",
    });
  }
  if (/(who (made|built|created|developed|designed) you|your (creator|developer|maker|team)|who is behind)/.test(t)) return aboutProject();
  if (/(how do you work|how does (this|it) work|this project|about (the |this )?(project|app)|architecture|tech stack|technolog|are you (an )?ai|are you real|backend|demo mode)/.test(t)) return aboutProject();
  if (/(^help$|what can you do|what do you do|features|^options$|^menu$|capabilit|how to use|ಸಹಾಯ)/.test(t)) return helpReply();

  /* 6. Time and date. */
  if (/(what time|time now|current time|what day|todays date|what is the date|whats the date|date today)/.test(t)) return timeReply();

  /* 7. Quiz. */
  if (/(quiz|test me|practice|practise|question me|ask me)/.test(t)) {
    if (/number/.test(t)) return startQuiz("numbers");
    const cat = Object.entries(LESSON_WORDS).find(([w]) => t.includes(w))?.[1];
    if (cat) return startQuiz("words", LESSON_CATEGORIES.findIndex((c) => c.id === cat));
    if (/(this|lesson|these)/.test(t) && mem.lesson !== undefined && mem.lesson !== null) return startQuiz("words", mem.lesson);
    return startQuiz("words");
  }

  /* 8. Stories. */
  if (/(story|stories|kathe|kate|ಕಥೆ|ಕತೆ)/.test(t)) return storyReply(mem);

  /* 9. Tulu Lipi, then the Kannada script. */
  if (/(tulu lipi|tigalari|\blipi\b|ತುಳು ಲಿಪಿ|ಲಿಪಿ)/.test(t) || (/full chart/.test(t))) {
    if (/open the full chart/.test(t)) {
      return englishReply("The full Tulu Lipi chart — all eight groups, with progress tracking — is on the **Learn** page under *Tulu Lipi*.", {
        suggestions: ["Show Tulu Lipi vowels", "What is Tulu Lipi?"], topic: "Tulu Lipi", link: { to: "/learn", label: "Open Learn → Tulu Lipi" },
      });
    }
    return lipiReply(t, text);
  }
  if (/kannada (script|alphabet|letters|vowels|consonants|akshara)|show kannada/.test(t)) return kannadaScriptReply(t);

  /* 10. Numbers. */
  const count = t.match(/count(?:ing)?(?: numbers)?(?: in tulu)?(?: from (\d+))?(?: (?:to|till|until|up to|upto|-) (\d+))?/);
  if (count) return countReply(Number(count[1] || 1), Number(count[2] || (count[1] ? Number(count[1]) + 9 : 10)));
  const range = t.match(/^(?:tulu )?numbers?(?: from)? (\d+) (?:to|-) (\d+)/);
  if (range) return countReply(Number(range[1]), Number(range[2]));
  if (/^(tulu numbers|numbers|numbers in tulu)$/.test(t) || /(show|teach|learn|list|tell)( me)?( the)?( tulu)? numbers/.test(t)) return countReply(1, 10);
  if (/^\d+$/.test(t)) return numberReply(Number(t));
  const numQ = t.match(/(?:what is|whats|how do you say|say|number|write)\s+(\d+|[a-z]+(?: [a-z]+)?)\s+in tulu/);
  if (numQ && readNumber(numQ[1])) return numberReply(readNumber(numQ[1]));

  /* 11. Lessons. */
  const nextLesson = t.match(/^(next|next lesson|another lesson|more|continue)(?:: .*)?$/) || /^next lesson/.test(t);
  if (nextLesson && mem.lesson !== undefined && mem.lesson !== null) return lessonReply(mem.lesson + 1);
  if (/(teach|learn|lesson|show me|start)/.test(t) || /ಕಲಿ/.test(t)) {
    const cat = Object.entries(LESSON_WORDS).find(([w]) => t.includes(w))?.[1];
    if (cat) return lessonReply(LESSON_CATEGORIES.findIndex((c) => c.id === cat));
    if (/(tulu|basics|something|me|lesson|start)/.test(t)) return lessonReply(mem.lesson !== undefined && mem.lesson !== null ? mem.lesson + 1 : 0);
  }

  /* 12. Meanings. */
  const meaningQ =
    extract(t, [
      /^(?:what does|what do|wat does)\s+(.+?)\s+means?(?: in english)?$/,
      /^(?:what is |whats )?(?:the )?meaning of\s+(.+)$/,
      /^(?:define|explain the word|explain)\s+(.+)$/,
      /^(.+?)\s+meaning$/,
      /^(?:use|using)\s+(.+?)\s+in a sentence$/,
    ]) ??
    (/ಅರ್ಥ/.test(t) ? t.replace(/ಅರ್ಥ(ವೇನು|ವೇನ|ಏನು)?|ಎಂತ|ದಾದ|ಏನು|ಪದದ|ಪದೊತ/g, "").trim() : null);
  if (meaningQ) {
    if (/in a sentence$/.test(t)) {
      const e = findTulu(meaningQ) ?? findEnglish(meaningQ);
      if (e?.corpus?.examples?.length) {
        return englishReply(`Here's **${e.tulu}** (${e.roman}) in real sentences from the demo corpus:`, {
          blocks: [wordBlock(e)], suggestions: ["Quiz me", "Another word"], topic: "Word meaning",
        });
      }
      if (e) {
        const uses = LEXICON.filter((x) => x !== e && x.tulu.includes(e.tulu) && !x.number).slice(0, 3);
        if (uses.length) {
          return englishReply(`Phrases that use **${e.tulu}** (${e.roman}):`, {
            blocks: [{ type: "phrases", items: uses.map((u) => asItem(u)) }], suggestions: ["Quiz me", "Another word"], topic: "Word meaning",
          });
        }
      }
    }
    const m = meaningOf(meaningQ.replace(/^(the word|word)\s+/, ""));
    if (m) return m;
    return englishReply(`I don't have **${meaningQ}** in my word list yet. The Dictionary page searches the project corpus, where it may appear.`, {
      suggestions: ["Another word", "What does ನೀರ್ mean?", "Teach me food words"],
      topic: "Word meaning",
      link: { to: "/dictionary", label: "Open Dictionary" },
      lookup: meaningQ,
    });
  }
  if (/^another word$/.test(t)) {
    const e = pick(LEXICON.filter((x) => x.corpus));
    return meaningOf(e.tulu);
  }

  /* 13. Translation requests. */
  const toTranslate = extract(t, [
    /^(?:how (?:do|would|can|should) (?:you|i|we|one) say|how to say|how do i say|how you say|how is)\s+(.+?)(?:\s+(?:in|into) tulu)?$/,
    /^(?:translate|say)\s+(.+?)(?:\s+(?:in|into|to) tulu)?$/,
    /^(?:what(?: is|s) )?(?:the )?tulu (?:word )?for\s+(.+)$/,
    /^(?:what(?: is|s)\s+)?(.+?)\s+in tulu$/,
    /^(.+?)\s+ತುಳುವಿನಲ್ಲಿ.*$/,
    /^(.+?)\s+ತುಳುವಲ್ಲಿ.*$/,
  ]);
  if (/^translate something else$/.test(t)) {
    return englishReply("Sure — type any English word or phrase, like “how do you say fish in Tulu?”", {
      suggestions: ["How do you say fish in Tulu?", "What is please sit in Tulu?", "Translate I am hungry"], topic: "Translation",
    });
  }
  if (toTranslate) {
    const tr = translateToTulu(toTranslate.replace(/^["']|["']$/g, ""));
    if (tr) return tr;
    return englishReply(`I don't have a Tulu translation for “${toTranslate}” in my data yet.`, {
      blocks: [{ type: "note", text: "Rather than guess, I only give Tulu that's in the project's verified word list. The Translate page will use the backend model once it's connected." }],
      suggestions: ["How do you say water in Tulu?", "Teach me daily phrases", "What can you do?"],
      topic: "Translation",
      link: { to: "/translate", label: "Open Translate" },
    });
  }

  /* 14. Facts about Tulu. */
  if (/\btulu\b|ತುಳು/.test(t) || /tulunadu|tulu nadu|mangalore|mangaluru|udupi/.test(t)) {
    if (/(where|region|spoken|place|area|district|state|tulu ?nadu)/.test(t)) return factReply("region");
    if (/(how many|speakers|population|people speak|number of people|census)/.test(t)) return factReply("speakers");
    if (/(script|written|write|alphabet|letters)/.test(t)) return factReply("script");
    if (/(dravidian|family|related|origin|history|old|ancient|kannada and tulu|difference)/.test(t)) return factReply("family");
    if (/(culture|festival|yakshagana|bhuta|bhoota|kola|kambala|tradition|food culture|cuisine)/.test(t)) return factReply("culture");
    if (/(official|schedule|recogni|status|government)/.test(t)) return factReply("status");
    if (/(why|important|endangered|low resource|preserv)/.test(t)) return factReply("why");
    if (/(what is|about|tell me|explain|language)/.test(t)) return factReply("overview");
  }
  if (/(yakshagana|bhuta kola|bhoota kola|kambala)/.test(t)) return factReply("culture");
  if (/(why build|why this|why tulu)/.test(t)) return factReply("why");

  /* 15. Something the person said that matches a known phrase — reply to it. */
  const fieldHit =
    findTulu(t) ??
    LEXICON.find((e) => !e.number && e.alts.includes(t.replace(/^im\b/, "i am")));
  if (fieldHit) {
    const convo = conversational(fieldHit, mem);
    if (convo) return convo;
    if (fieldHit.number) return numberReply(fieldHit.number);
    return meaningOf(fieldHit.tulu);
  }

  /* 16. A single word we can translate either way. */
  if (t.split(" ").length <= 3) {
    const e = findEnglish(t);
    if (e) return translateToTulu(t);
  }

  return fallback(text);
}


/* ==========================================================================
   DICTIONARY SEARCH — used by the Dictionary page in demo mode.

   Searches every entry above (lessons, phrasebook, demo corpus, numbers)
   by Tulu in Kannada script, Tulu in Latin letters, English meaning or
   Kannada equivalent, and ranks the results: exact matches first, then
   whole words inside phrases, then prefixes, then close spellings.
   Nothing is generated; every result is an entry from the data files.
   ========================================================================== */

const KN_DIGIT = /[೦-೯]/g;
/* How a learner might spell it by ear: neer ≈ nir, pudar ≈ pudhar. */
const sound = (s) =>
  squash(s)
    .replace(/[^a-z]/g, "")
    .replace(/(ee|ii)/g, "i")
    .replace(/(oo|uu)/g, "u")
    .replace(/aa/g, "a")
    .replace(/([bcdghjklmnprstvy])h/g, "$1")
    .replace(/(.)\1+/g, "$1")
    .replace(/w/g, "v");
const asciiDigits = (s) => s.replace(KN_DIGIT, (d) => String(d.charCodeAt(0) - 0x0ce6));
const LESSON_LABEL = Object.fromEntries(LESSON_CATEGORIES.map((c) => [c.id, c.label]));

function sourcesOf(e) {
  const out = [];
  if (e.category) out.push(`Lesson · ${LESSON_LABEL[e.category]}`);
  if (e.phrasebook) out.push("Phrasebook");
  if (e.corpus) out.push("Demo corpus");
  if (e.number) out.push("Numbers");
  return out;
}

function meaningsOf(e) {
  if (e.number) return [`${e.number}`, englishNumber(e.number)];
  const seen = new Set();
  const out = [];
  for (const m of [e.english, ...e.alts]) {
    const key = norm(m);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(cap(m.replace(/\.$/, "")));
  }
  return out;
}

/* Phrases in the data that contain this word. */
function usedIn(e) {
  if (e.number || e.tulu.includes(" ")) return [];
  const w = norm(e.tulu);
  return LEXICON.filter((x) => x !== e && !x.number && ` ${norm(x.tulu)} `.includes(` ${w} `))
    .slice(0, 6)
    .map((x) => ({ tulu: x.tulu, roman: x.roman, english: x.english }));
}

function card(e, how) {
  return {
    word: e.tulu,
    roman: e.roman,
    english: e.number ? `${e.number} — ${englishNumber(e.number)}` : e.english,
    meanings: meaningsOf(e),
    kannada: e.kannadaAlts ?? [],
    frequency: e.corpus?.frequency ?? null,
    examples: e.corpus?.examples ?? [],
    usedIn: usedIn(e),
    sources: sourcesOf(e),
    matchedBy: how,
    composed: !!e.composed,
  };
}

export const DICTIONARY_SIZE = LEXICON.length;

/* Read-only view of the merged word list (used to export data for the backend). */
export const lexiconEntries = () => LEXICON;

export function searchDictionary(raw) {
  const query = (raw || "").trim();
  const q = norm(asciiDigits(query));
  if (!q) return { query, best: null, related: [], sentences: [], total: 0 };

  const isKn = KANNADA.test(q);
  const qk = tuluKey(q);
  const qs = squash(q);
  const num = readNumber(q) ?? Number(Object.entries(KANNADA_NUMBERS).find(([, w]) => tuluKey(w) === qk)?.[0] || 0);
  const spaced = (s) => ` ${norm(s)} `;

  const scored = [];
  for (const e of LEXICON) {
    let score = 0;
    let how = "";
    const bump = (sc, h) => {
      if (sc > score) {
        score = sc;
        how = h;
      }
    };
    const tk = tuluKey(e.tulu);
    const rs = squash(e.roman || "");
    const kns = e.kannadaAlts ?? [];

    if (tk === qk) bump(100, "Tulu");
    if (!isKn && rs === qs) bump(96, "Tulu (Latin letters)");
    if (e.number && num === e.number) bump(98, "Number");
    if (!isKn && e.alts.includes(q)) bump(94, "English meaning");
    if (isKn && kns.some((k) => tuluKey(k) === qk)) bump(94, "Kannada");

    // Numbers only match exactly, or searching "one" would list half of them.
    if (!e.number && q.length >= 2) {
      if (isKn) {
        if (spaced(e.tulu).includes(` ${q} `)) bump(72, "Tulu");
        if (kns.some((k) => spaced(k).includes(` ${q} `))) bump(66, "Kannada");
        if (tk.startsWith(qk)) bump(60, "Tulu");
        if (kns.some((k) => tuluKey(k).startsWith(qk))) bump(56, "Kannada");
        if (qk.length >= 2 && tk.includes(qk)) bump(42, "Tulu");
        if (qk.length >= 2 && kns.some((k) => tuluKey(k).includes(qk))) bump(38, "Kannada");
      } else {
        if (spaced(e.roman).includes(` ${q} `)) bump(72, "Tulu (Latin letters)");
        if (e.alts.some((a) => ` ${a} `.includes(` ${q} `))) bump(66, "English meaning");
        if (q.length >= 3 && rs.startsWith(qs)) bump(58, "Tulu (Latin letters)");
        if (q.length >= 3 && e.alts.some((a) => a.startsWith(q))) bump(55, "English meaning");
        if (q.length >= 3 && rs.includes(qs)) bump(40, "Tulu (Latin letters)");
        if (q.length >= 3 && e.roman && e.roman.split(" ").some((w) => sound(w) === sound(q))) bump(46, "Sounds like");
        if (q.length >= 3 && e.roman && sound(e.roman) === sound(q)) bump(50, "Sounds like");
        const lim = qs.length >= 7 ? 2 : qs.length >= 4 ? 1 : 0;
        if (lim && !score) {
          if (distance(rs, qs) <= lim) bump(30, "Similar spelling");
          else if (e.alts.some((a) => distance(a.replace(/\s/g, ""), qs) <= lim)) bump(28, "Similar spelling");
          else if (e.roman && e.roman.split(" ").some((w) => w.length >= 4 && distance(squash(w), qs) <= lim)) bump(26, "Similar spelling");
        }
      }
    }
    if (score) scored.push({ e, score, how });
  }

  scored.sort((a, b) => b.score - a.score || a.e.tulu.length - b.e.tulu.length);
  const best = scored[0] ? card(scored[0].e, scored[0].how) : null;

  // Corpus sentences that contain a Tulu search term.
  const sentences = [];
  if (isKn) {
    for (const [word, c] of Object.entries(DEMO_CORPUS)) {
      for (const ex of c.examples) {
        if (spaced(ex).includes(` ${q} `) && !(best && best.examples.includes(ex)) && !sentences.some((s) => s.text === ex)) {
          sentences.push({ text: ex, word });
        }
      }
    }
  }

  return {
    query,
    best,
    fuzzy: !!scored[0] && scored[0].score <= 30,
    related: scored.slice(1, 9).map(({ e, how }) => ({
      tulu: e.tulu,
      roman: e.roman,
      english: e.number ? `${e.number}` : e.english,
      matchedBy: how,
    })),
    sentences: sentences.slice(0, 6),
    total: scored.length,
  };
}

/* Everything, grouped for browsing. Numbers are left out — there are 100. */
export function browseDictionary() {
  const groups = [
    ...LESSON_CATEGORIES.map((c) => ({ id: c.id, label: c.label, match: (e) => e.category === c.id })),
    { id: "phrasebook", label: "Phrasebook", match: (e) => e.phrasebook && !e.category },
    { id: "corpus", label: "Corpus words", match: (e) => e.corpus && !e.category && !e.phrasebook },
  ];
  return groups.map((g) => ({
    id: g.id,
    label: g.label,
    items: LEXICON.filter((e) => !e.number && g.match(e)).map((e) => ({ tulu: e.tulu, roman: e.roman, english: e.english })),
  }));
}
