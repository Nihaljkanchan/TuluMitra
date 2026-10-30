/* ==========================================================================
   TULU LIPI (Tulu-Tigalari script) — the script historically used to write
   Tulu, encoded in Unicode 16.0 as the Tulu-Tigalari block, U+11380–U+113FF.

   Every codepoint below was generated from the Unicode character database
   and checked against its official character name, so the mappings are not
   hand-typed guesses.

   ── TWO THINGS TO KNOW ────────────────────────────────────────────────────
   1. FONT. Rendering these letters needs a font that covers U+11380–U+113FF.
      No such font ships with Windows, macOS, Android or iOS today, and none
      is available on Google Fonts, npm or Fontsource. Without one the
      browser shows empty boxes. Drop a font file into public/fonts/ (see the
      README there) and it is picked up automatically; until then the app
      detects the missing font and says so instead of showing boxes.

   2. SHORT e AND SHORT o are not in Unicode yet. The chart lists them, but
      the Tulu-Tigalari block encodes only the long EE and OO — the slots at
      U+1138A and U+1138F are unassigned, and a 2025 proposal to add them is
      still open. Those two rows carry no glyph here rather than borrowing
      the wrong one.
   ========================================================================== */

export const LIPI_GROUPS = [
  {
    id: "vowels",
    label: "Vowels",
    kn: "ಸ್ವರ",
    letters: [
      { lipi: "𑎀", cp: "U+11380", roman: "a", kannada: "ಅ" },
      { lipi: "𑎁", cp: "U+11381", roman: "ā", kannada: "ಆ" },
      { lipi: "𑎂", cp: "U+11382", roman: "i", kannada: "ಇ" },
      { lipi: "𑎃", cp: "U+11383", roman: "ī", kannada: "ಈ" },
      { lipi: "𑎄", cp: "U+11384", roman: "u", kannada: "ಉ" },
      { lipi: "𑎅", cp: "U+11385", roman: "ū", kannada: "ಊ" },
      { lipi: "𑎆", cp: "U+11386", roman: "ṛ", kannada: "ಋ" },
      { lipi: "𑎇", cp: "U+11387", roman: "ṝ", kannada: "ೠ" },
      { lipi: "\u{1138A}", cp: "U+1138A", roman: "e", kannada: "ಎ" },
      { lipi: "𑎋", cp: "U+1138B", roman: "ē", kannada: "ಏ" },
      { lipi: "𑎎", cp: "U+1138E", roman: "ai", kannada: "ಐ" },
      { lipi: "\u{1138F}", cp: "U+1138F", roman: "o", kannada: "ಒ" },
      { lipi: "𑎐", cp: "U+11390", roman: "ō", kannada: "ಓ" },
      { lipi: "𑎑", cp: "U+11391", roman: "au", kannada: "ಔ" },
    ],
  },
  {
    id: "ka",
    label: "Ka-varga",
    kn: "ಕ ವರ್ಗ",
    letters: [
      { lipi: "𑎒", cp: "U+11392", roman: "ka", kannada: "ಕ" },
      { lipi: "𑎓", cp: "U+11393", roman: "kha", kannada: "ಖ" },
      { lipi: "𑎔", cp: "U+11394", roman: "ga", kannada: "ಗ" },
      { lipi: "𑎕", cp: "U+11395", roman: "gha", kannada: "ಘ" },
      { lipi: "𑎖", cp: "U+11396", roman: "ṅa", kannada: "ಙ" },
    ],
  },
  {
    id: "ca",
    label: "Ca-varga",
    kn: "ಚ ವರ್ಗ",
    letters: [
      { lipi: "𑎗", cp: "U+11397", roman: "ca", kannada: "ಚ" },
      { lipi: "𑎘", cp: "U+11398", roman: "cha", kannada: "ಛ" },
      { lipi: "𑎙", cp: "U+11399", roman: "ja", kannada: "ಜ" },
      { lipi: "𑎚", cp: "U+1139A", roman: "jha", kannada: "ಝ" },
      { lipi: "𑎛", cp: "U+1139B", roman: "ña", kannada: "ಞ" },
    ],
  },
  {
    id: "tta",
    label: "Ṭa-varga",
    kn: "ಟ ವರ್ಗ",
    letters: [
      { lipi: "𑎜", cp: "U+1139C", roman: "ṭa", kannada: "ಟ" },
      { lipi: "𑎝", cp: "U+1139D", roman: "ṭha", kannada: "ಠ" },
      { lipi: "𑎞", cp: "U+1139E", roman: "ḍa", kannada: "ಡ" },
      { lipi: "𑎟", cp: "U+1139F", roman: "ḍha", kannada: "ಢ" },
      { lipi: "𑎠", cp: "U+113A0", roman: "ṇa", kannada: "ಣ" },
    ],
  },
  {
    id: "ta",
    label: "Ta-varga",
    kn: "ತ ವರ್ಗ",
    letters: [
      { lipi: "𑎡", cp: "U+113A1", roman: "ta", kannada: "ತ" },
      { lipi: "𑎢", cp: "U+113A2", roman: "tha", kannada: "ಥ" },
      { lipi: "𑎣", cp: "U+113A3", roman: "da", kannada: "ದ" },
      { lipi: "𑎤", cp: "U+113A4", roman: "dha", kannada: "ಧ" },
      { lipi: "𑎥", cp: "U+113A5", roman: "na", kannada: "ನ" },
    ],
  },
  {
    id: "pa",
    label: "Pa-varga",
    kn: "ಪ ವರ್ಗ",
    letters: [
      { lipi: "𑎦", cp: "U+113A6", roman: "pa", kannada: "ಪ" },
      { lipi: "𑎧", cp: "U+113A7", roman: "pha", kannada: "ಫ" },
      { lipi: "𑎨", cp: "U+113A8", roman: "ba", kannada: "ಬ" },
      { lipi: "𑎩", cp: "U+113A9", roman: "bha", kannada: "ಭ" },
      { lipi: "𑎪", cp: "U+113AA", roman: "ma", kannada: "ಮ" },
    ],
  },
  {
    id: "other",
    label: "Other consonants",
    kn: "ಇತರ",
    letters: [
      { lipi: "𑎫", cp: "U+113AB", roman: "ya", kannada: "ಯ" },
      { lipi: "𑎬", cp: "U+113AC", roman: "ra", kannada: "ರ" },
      { lipi: "𑎭", cp: "U+113AD", roman: "la", kannada: "ಲ" },
      { lipi: "𑎮", cp: "U+113AE", roman: "va", kannada: "ವ" },
      { lipi: "𑎯", cp: "U+113AF", roman: "śa", kannada: "ಶ" },
      { lipi: "𑎰", cp: "U+113B0", roman: "ṣa", kannada: "ಷ" },
      { lipi: "𑎱", cp: "U+113B1", roman: "sa", kannada: "ಸ" },
      { lipi: "𑎲", cp: "U+113B2", roman: "ha", kannada: "ಹ" },
    ],
  },
  {
    id: "extra",
    label: "Additional letters",
    kn: "ಹೆಚ್ಚುವರಿ",
    letters: [
      { lipi: "𑎳", cp: "U+113B3", roman: "ḷa", kannada: "ಳ" },
      { lipi: "𑎴", cp: "U+113B4", roman: "ṟa", kannada: "ಱ" },
      { lipi: "𑎵", cp: "U+113B5", roman: "ḻa", kannada: "ೞ" },
    ],
  },
];

/* Vowel signs and marks — used by the transliteration map, not shown as cards. */
export const LIPI_SIGNS = {
  "ಾ": "𑎸", // U+113B8 TULU-TIGALARI VOWEL SIGN AA
  "ಿ": "𑎹", // U+113B9 TULU-TIGALARI VOWEL SIGN I
  "ೀ": "𑎺", // U+113BA TULU-TIGALARI VOWEL SIGN II
  "ು": "𑎻", // U+113BB TULU-TIGALARI VOWEL SIGN U
  "ೂ": "𑎼", // U+113BC TULU-TIGALARI VOWEL SIGN UU
  "ೃ": "𑎽", // U+113BD TULU-TIGALARI VOWEL SIGN VOCALIC R
  "ೄ": "𑎾", // U+113BE TULU-TIGALARI VOWEL SIGN VOCALIC RR
  "ೇ": "𑏂", // U+113C2 TULU-TIGALARI VOWEL SIGN EE
  "ೈ": "𑏅", // U+113C5 TULU-TIGALARI VOWEL SIGN AI
  "ೋ": "𑏇", // U+113C7 TULU-TIGALARI VOWEL SIGN OO
  "ೌ": "𑏈", // U+113C8 TULU-TIGALARI VOWEL SIGN AU
  "ಂ": "𑏌", // U+113CC TULU-TIGALARI SIGN ANUSVARA
  "ಃ": "𑏍", // U+113CD TULU-TIGALARI SIGN VISARGA
  "್": "𑏎", // U+113CE TULU-TIGALARI SIGN VIRAMA
};

/* Sample glyphs used to test whether the viewer's device has a font that can
   draw this script. */
export const LIPI_PROBES = [
  "𑎒", // U+11392 KA
  "𑎀", // U+11380 A
  "𑎥", // U+113A5 NA
  "𑎲", // U+113B2 HA
  "𑎎", // U+1138E AI
];

/* A codepoint from this SAME block that Unicode has unassigned (U+113FF).
   It is a guaranteed "missing glyph" box on devices without font support. */
export const LIPI_MISSING_REF = "\u{113FF}";

export const LIPI_TOTAL = LIPI_GROUPS.reduce((n, g) => n + g.letters.length, 0);

/* Kannada letter → Tulu Lipi letter, for transliterating the corpus. */
export const KANNADA_TO_LIPI = LIPI_GROUPS.reduce((m, g) => {
  for (const l of g.letters) if (l.lipi) m[l.kannada] = l.lipi;
  return m;
}, { ...LIPI_SIGNS });
