/* ==========================================================================
   DEMO DATASET — used only when no backend is connected (mock mode).

   This is a small, hand-written sample of Tulu content that lets the whole
   interface be demonstrated end to end without the Flask backend running.
   It is NOT model output: nothing here comes from a trained ASR or TTS model.
   The footer shows a "Demo data" badge whenever this file is in use.

   When VITE_API_URL is set, the real backend replaces every function that
   reads this file, and none of it is used.
   ========================================================================== */

/* --- Corpus entries for the Dictionary page -----------------------------
   Frequencies are illustrative counts of the kind the real 83,704-sentence
   corpus returns. Verify the Tulu with a native speaker before presenting. */
export const DEMO_CORPUS = {
  "ನೀರ್": {
    roman: "neer",
    english: "water",
    frequency: 412,
    examples: [
      "ಎಂಕ್ ಒಂತೆ ನೀರ್ ಕೊರ್ಲೆ.",
      "ಬಾವಿಡ್ ನೀರ್ ಉಂಡು.",
      "ನೀರ್ ಪಿರ‍್ಯೆರೆ ಗ್ಲಾಸ್ ಕನಪುಲೆ.",
    ],
  },
  "ಬಲ": {
    roman: "bala",
    english: "come",
    frequency: 268,
    examples: ["ಇಡೆ ಬಲ.", "ಬೇಗ ಬಲ, ಸಮಯ ಆಂಡ್.", "ಇಂಬೆ ಬಲ ಪಂಡ್ದ್ ಲೆತ್ತೆ."],
  },
  "ಪುದರ್": {
    roman: "pudar",
    english: "name",
    frequency: 193,
    examples: ["ಈರೆನ ಪುದರ್ ದಾದ?", "ಎನ್ನ ಪುದರ್ ನಿಹಾಲ್.", "ಊರ್‌ದ ಪುದರ್ ಮಂಗಳೂರು."],
  },
  "ಎಂಚ": {
    roman: "encha",
    english: "how",
    frequency: 351,
    examples: ["ಎಂಚ ಉಲ್ಲರ್?", "ಈ ಬೇಲೆ ಎಂಚ ಮಲ್ಪುನಿ?", "ಎಂಚ ಪೋಪುಗ?"],
  },
  "ಉಂಡು": {
    roman: "undu",
    english: "is / there is",
    frequency: 587,
    examples: ["ಎಂಕ್ ಎಡ್ಡೆ ಉಂಡು.", "ಇಲ್ಲಡ್ ಆಯೆ ಉಂಡು.", "ಬಾವಿಡ್ ನೀರ್ ಉಂಡು."],
  },
  "ಮೀನ್": {
    roman: "meen",
    english: "fish",
    frequency: 226,
    examples: ["ಇನಿ ಮೀನ್ ತಿಂದೆ.", "ಮೀನ್ ಸಾರ್ ಎಡ್ಡೆ ಉಂಡು.", "ಮಾರ್ಕೆಟ್‌ಡ್ ಮೀನ್ ತಿಕ್ಕುಂಡು."],
  },
  "ನುಪ್ಪು": {
    roman: "nuppu",
    english: "cooked rice",
    frequency: 174,
    examples: ["ನುಪ್ಪು ತಿನ್ಲೆ.", "ನುಪ್ಪು ಬೆಚ್ಚ ಉಂಡು.", "ಎಂಕ್ ನುಪ್ಪು ಬೋಡು."],
  },
  "ಒಂಜಿ": {
    roman: "onji",
    english: "one",
    frequency: 498,
    examples: ["ಒಂಜಿ ಕತೆ ಪಂಡ್‌ಲೆ.", "ಒಂಜಿ ನಿಮಿಷ ತಾಳ್ಮೆ ಮಲ್ಪುಲೆ.", "ಒಂಜಿ ಗ್ಲಾಸ್ ನೀರ್ ಕೊರ್ಲೆ."],
  },
  "ಪೋಲ": {
    roman: "pola",
    english: "go",
    frequency: 241,
    examples: ["ಬೇಗ ಪೋಲ.", "ಇಲ್ಲಗ್ ಪೋಲ.", "ಈ ದಾರಿಡ್ ಪೋಲ."],
  },
  "ಸರಿ": {
    roman: "sari",
    english: "alright / correct",
    frequency: 309,
    examples: ["ಸರಿ, ಪಂಡ್‌ಲೆ.", "ಅವು ಸರಿ ಉಂಡು.", "ಸರಿ, ಯಾನ್ ಬರ್ಪೆ."],
  },
  "ಎಡ್ಡೆ": {
    roman: "edde",
    english: "good / well",
    frequency: 372,
    examples: ["ಎಂಕ್ ಎಡ್ಡೆ ಉಂಡು.", "ಈ ಬೇಲೆ ಎಡ್ಡೆ ಆಂಡ್.", "ಎಡ್ಡೆ ದಿನ ಆಪುಗ."],
  },
  "ಕುಲ್ಲುಲೆ": {
    roman: "kullule",
    english: "please sit",
    frequency: 88,
    examples: ["ಇಡೆ ಕುಲ್ಲುಲೆ.", "ಒಂತೆ ಪೊರ್ತು ಕುಲ್ಲುಲೆ."],
  },
  "ಬಜಿಲ್": {
    roman: "bajil",
    english: "beaten rice",
    frequency: 64,
    examples: ["ಬಜಿಲ್ ತಿಂದೆಯಾ?", "ಕಾಂಡೆ ಬಜಿಲ್ ಉಂಡು."],
  },
  "ಪೆಲಕಾಯಿ": {
    roman: "pelakaayi",
    english: "jackfruit",
    frequency: 57,
    examples: ["ಪೆಲಕಾಯಿ ಎಡ್ಡೆ ಉಂಡು.", "ಮರತ್ತ್‌ಡ್ ಪೆಲಕಾಯಿ ಉಂಡು."],
  },
  "ಸೊಲ್ಮೆಲು": {
    roman: "solmelu",
    english: "greetings",
    frequency: 41,
    examples: ["ಸೊಲ್ಮೆಲು, ಎಂಚ ಉಲ್ಲರ್?", "ಮಾತೆರೆಗ್ಲಾ ಸೊಲ್ಮೆಲು."],
  },
};

/* --- Phrase pairs used by Translate and by the chat replies -------------- */
export const DEMO_PHRASES = [
  { english: "how are you", kannada: "ನೀವು ಹೇಗಿದ್ದೀರಿ", tulu: "ಎಂಚ ಉಲ್ಲರ್?", roman: "encha ullar?" },
  { english: "i am well", kannada: "ನಾನು ಚೆನ್ನಾಗಿದ್ದೇನೆ", tulu: "ಎಂಕ್ ಎಡ್ಡೆ ಉಂಡು", roman: "enk edde undu" },
  { english: "what is your name", kannada: "ನಿಮ್ಮ ಹೆಸರೇನು", tulu: "ಈರೆನ ಪುದರ್ ದಾದ?", roman: "eerena pudar daada?" },
  { english: "good morning", kannada: "ಶುಭೋದಯ", tulu: "ಸೊಲ್ಮೆಲು", roman: "solmelu" },
  { english: "where are you going", kannada: "ಎಲ್ಲಿಗೆ ಹೋಗುತ್ತಿದ್ದೀರಿ", tulu: "ಒಲ್ಪ ಪೋಪುಗ?", roman: "olpa popuga?" },
  { english: "what are you doing", kannada: "ಏನು ಮಾಡುತ್ತಿದ್ದೀರಿ", tulu: "ದಾದ ಮಲ್ಪುಗ?", roman: "daada malpuga?" },
  { english: "i am hungry", kannada: "ನನಗೆ ಹಸಿವಾಗಿದೆ", tulu: "ಎಂಕ್ ಬಚ್ಚಿರೆ ಆಪುಂಡು", roman: "enk bacchire aapundu" },
  { english: "give me water", kannada: "ನನಗೆ ನೀರು ಕೊಡಿ", tulu: "ಎಂಕ್ ಒಂತೆ ನೀರ್ ಕೊರ್ಲೆ", roman: "enk onte neer korle" },
  { english: "please come", kannada: "ದಯವಿಟ್ಟು ಬನ್ನಿ", tulu: "ದಯ ಮಲ್ತ್‌ದ್ ಬಲ", roman: "daya maltd bala" },
  { english: "i do not know", kannada: "ನನಗೆ ಗೊತ್ತಿಲ್ಲ", tulu: "ಎಂಕ್ ಗೊತ್ತಿಜ್ಜಿ", roman: "enk gottijji" },
  { english: "see you again", kannada: "ಮತ್ತೆ ಸಿಗೋಣ", tulu: "ಬೊಕ್ಕ ತಿಕ್ಕುಗ", roman: "bokka tikkuga" },
  { english: "please sit", kannada: "ದಯವಿಟ್ಟು ಕುಳಿತುಕೊಳ್ಳಿ", tulu: "ಕುಲ್ಲುಲೆ", roman: "kullule" },
];

/* --- Intent keywords, mirroring the backend's intent_detector module ----- */
export const DEMO_INTENTS = {
  greeting: ["hello", "hi", "hey", "good morning", "namaskara", "ಸೊಲ್ಮೆಲು", "ನಮಸ್ಕಾರ", "ಎಂಚ"],
  dictionary: ["meaning", "what does", "define", "word", "ಅರ್ಥ"],
  translation: ["translate", "in tulu", "how do you say", "ಅನುವಾದ"],
  teaching: ["teach", "learn", "lesson", "practice", "ಕಲಿ"],
  help: ["help", "what can you do", "options", "ಸಹಾಯ"],
};

/* --- Replies the demo assistant gives, one per detected intent ----------- */
export const DEMO_REPLIES = {
  greeting: {
    tulu: "ಸೊಲ್ಮೆಲು! ಎಂಕ್ ಎಡ್ಡೆ ಉಂಡು. ಈರೆಗ್ ಎಂಚ ಉಂಡು?",
    roman: "solmelu! enk edde undu. eereg encha undu?",
    english: "Greetings! I am well. How are you?",
  },
  dictionary: {
    tulu: "ಆ ಪದತ್ತ ಅರ್ಥ ಡಿಕ್ಷನರಿಡ್ ತೂಲೆ.",
    roman: "aa padatta artha dictionary-d toole.",
    english: "You can look up that word's meaning on the Dictionary page.",
  },
  translation: {
    tulu: "ಅವು ತುಳುಟ್ಟು ಇಂಚ ಪನ್ಪೆರ್.",
    roman: "avu tuluttu incha panper.",
    english: "In Tulu, that is said this way.",
  },
  teaching: {
    tulu: "ಬಲ, ಒಂಜಿ ಪಾಠ ಸುರು ಮಲ್ಪುಗ. ಲರ್ನ್ ಪುಟಡ್ ವಾಕ್ಯೊಲು ಉಂಡು.",
    roman: "bala, onji paatha suru malpuga. Learn putad vaakyolu undu.",
    english: "Come, let us start a lesson. The Learn page has sentences to practise.",
  },
  help: {
    tulu: "ಯಾನ್ ತುಳುಟ್ಟು ಮಾತಾಡುವೆ, ಪದೊತ ಅರ್ಥ ಪನ್ಪೆ, ಅನುವಾದ ಮಲ್ಪುವೆ.",
    roman: "yaan tuluttu maataaduve, padota artha panpe, anuvaada malpuve.",
    english: "I can talk in Tulu, give word meanings, and translate for you.",
  },
  conversation: {
    tulu: "ಒಂತೆ ವಿವರ ಪಂಡ್‌ಲೆ, ಯಾನ್ ಸಹಾಯ ಮಲ್ಪುವೆ.",
    roman: "onte vivara pandle, yaan sahaaya malpuve.",
    english: "Tell me a little more and I will help.",
  },
};
