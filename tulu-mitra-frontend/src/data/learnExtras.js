/* ==========================================================================
   Numbers and script for the Learn page.

   ── VERIFY BEFORE THE DEMO ────────────────────────────────────────────────
   1–20, the tens words and 100 are written out individually below. Every
   other number (21, 34, 57 …) is COMPOSED in code as "tens word + unit
   word" — 21 becomes ಇರ್ವ ಒಂಜಿ. Spoken Tulu commonly fuses those into a
   single word and the fused spellings vary from place to place, so they are
   left as two words rather than guessed at, and the interface marks every
   composed number so nobody mistakes it for a verified spelling.

   The least certain entries are the tens from 60 to 90. Have a native
   speaker check those first.

   The script section is the KANNADA script, which is what Tulu is written
   in today — there is no separate modern Tulu alphabet. (Older Tulu
   manuscripts used the Tigalari script, which is not included here.)
   ========================================================================== */

/* 1–9. These also form the unit half of every composed number. */
const UNITS = [
  { tulu: "ಒಂಜಿ", roman: "onji" },
  { tulu: "ರಡ್ಡ್", roman: "radd" },
  { tulu: "ಮೂಜಿ", roman: "mooji" },
  { tulu: "ನಾಲ್", roman: "naal" },
  { tulu: "ಐನ್", roman: "ain" },
  { tulu: "ಆಜಿ", roman: "aaji" },
  { tulu: "ಏಳ್", roman: "elu" },
  { tulu: "ಎಣ್ಮ", roman: "enma" },
  { tulu: "ಒರ್ಂಬ", roman: "ormba" },
];

/* 10–19 are irregular, so each is written out rather than composed. */
const TEENS = {
  10: { tulu: "ಪತ್ತ್", roman: "patt" },
  11: { tulu: "ಪದಿನೊಂಜಿ", roman: "padinonji" },
  12: { tulu: "ಪದಿರಡ್ಡ್", roman: "padiradd" },
  13: { tulu: "ಪದಿಮೂಜಿ", roman: "padimooji" },
  14: { tulu: "ಪದಿನಾಲ್", roman: "padinaal" },
  15: { tulu: "ಪದಿನೈನ್", roman: "padinain" },
  16: { tulu: "ಪದಿನಾಜಿ", roman: "padinaaji" },
  17: { tulu: "ಪದಿನೇಳ್", roman: "padinelu" },
  18: { tulu: "ಪದಿನೆಣ್ಮ", roman: "padinenma" },
  19: { tulu: "ಪದಿನೊರ್ಂಬ", roman: "padinormba" },
};

/* The tens words — the least certain part of this file. */
const TENS = {
  20: { tulu: "ಇರ್ವ", roman: "irva" },
  30: { tulu: "ಮುಪ್ಪ", roman: "muppa" },
  40: { tulu: "ನಲ್ಪ", roman: "nalpa" },
  50: { tulu: "ಐವ", roman: "aiva" },
  60: { tulu: "ಅಜಿಪ್ಪ", roman: "ajippa" },
  70: { tulu: "ಎಳ್ಪ", roman: "elpa" },
  80: { tulu: "ಎಣ್ಪ", roman: "enpa" },
  90: { tulu: "ತೊಂಬ", roman: "tomba" },
};

const HUNDRED = { tulu: "ನೂದು", roman: "noodu" };

export function numberWord(n) {
  if (n <= 9) return { ...UNITS[n - 1], composed: false };
  if (n <= 19) return { ...TEENS[n], composed: false };
  if (n === 100) return { ...HUNDRED, composed: false };

  const tensValue = Math.floor(n / 10) * 10;
  const unit = n % 10;
  if (unit === 0) return { ...TENS[tensValue], composed: false };

  const t = TENS[tensValue];
  const u = UNITS[unit - 1];
  return {
    tulu: `${t.tulu} ${u.tulu}`,
    roman: `${t.roman} ${u.roman}`,
    composed: true,
  };
}

/* Ten pages of ten: 1–10, 11–20 … 91–100. */
export const NUMBER_PAGES = Array.from({ length: 10 }, (_, page) => {
  const from = page * 10 + 1;
  const to = from + 9;
  return {
    id: `n${from}`,
    label: `${from}–${to}`,
    from,
    to,
    items: Array.from({ length: 10 }, (_, i) => {
      const value = from + i;
      return { value, ...numberWord(value) };
    }),
  };
});

export const NUMBER_TOTAL = 100;

/* --- The Kannada script, as used for writing Tulu ----------------------- */
export const SCRIPT_GROUPS = [
  {
    id: "vowels",
    label: "Vowels",
    kn: "ಸ್ವರ",
    note: "Standalone vowel letters. Inside a word a vowel appears instead as a mark attached to the consonant it follows.",
    letters: [
      { letter: "ಅ", roman: "a" },
      { letter: "ಆ", roman: "aa" },
      { letter: "ಇ", roman: "i" },
      { letter: "ಈ", roman: "ee" },
      { letter: "ಉ", roman: "u" },
      { letter: "ಊ", roman: "oo" },
      { letter: "ಋ", roman: "ru" },
      { letter: "ಎ", roman: "e" },
      { letter: "ಏ", roman: "ae" },
      { letter: "ಐ", roman: "ai" },
      { letter: "ಒ", roman: "o" },
      { letter: "ಓ", roman: "oh" },
      { letter: "ಔ", roman: "au" },
      { letter: "ಅಂ", roman: "am" },
      { letter: "ಅಃ", roman: "ah" },
    ],
  },
  {
    id: "consonants",
    label: "Consonants",
    kn: "ವ್ಯಂಜನ",
    note: "Every consonant already carries an 'a' sound. Adding a vowel mark changes it — ಕ is ka, ಕಿ is ki, ಕೂ is koo.",
    letters: [
      { letter: "ಕ", roman: "ka" },
      { letter: "ಖ", roman: "kha" },
      { letter: "ಗ", roman: "ga" },
      { letter: "ಘ", roman: "gha" },
      { letter: "ಙ", roman: "nga" },
      { letter: "ಚ", roman: "cha" },
      { letter: "ಛ", roman: "chha" },
      { letter: "ಜ", roman: "ja" },
      { letter: "ಝ", roman: "jha" },
      { letter: "ಞ", roman: "nya" },
      { letter: "ಟ", roman: "ṭa" },
      { letter: "ಠ", roman: "ṭha" },
      { letter: "ಡ", roman: "ḍa" },
      { letter: "ಢ", roman: "ḍha" },
      { letter: "ಣ", roman: "ṇa" },
      { letter: "ತ", roman: "ta" },
      { letter: "ಥ", roman: "tha" },
      { letter: "ದ", roman: "da" },
      { letter: "ಧ", roman: "dha" },
      { letter: "ನ", roman: "na" },
      { letter: "ಪ", roman: "pa" },
      { letter: "ಫ", roman: "pha" },
      { letter: "ಬ", roman: "ba" },
      { letter: "ಭ", roman: "bha" },
      { letter: "ಮ", roman: "ma" },
      { letter: "ಯ", roman: "ya" },
      { letter: "ರ", roman: "ra" },
      { letter: "ಲ", roman: "la" },
      { letter: "ವ", roman: "va" },
      { letter: "ಶ", roman: "sha" },
      { letter: "ಷ", roman: "ṣha" },
      { letter: "ಸ", roman: "sa" },
      { letter: "ಹ", roman: "ha" },
      { letter: "ಳ", roman: "ḷa" },
    ],
  },
];

export const SCRIPT_TOTAL = SCRIPT_GROUPS.reduce((n, g) => n + g.letters.length, 0);
