/* ==========================================================================
   Welcome-screen greetings.

   Edit freely: add phrases, or change the hours. Each Tulu line has a
   Latin spelling and an English meaning, like the rest of the site.
   Please have a Tulu speaker check any phrase you add.

   ಸೊಲ್ಮೆಲು (solmelu) is the everyday Tulu greeting for any time of day,
   so it is always the headline; the question under it changes with the
   time of day and with whether this is a first or a returning visit.
   ========================================================================== */

/* English lead-in by time of day (24-hour clock, the viewer's local time). */
export const TIME_OF_DAY = [
  { from: 5, to: 12, key: "morning", english: "Good morning" },
  { from: 12, to: 17, key: "afternoon", english: "Good afternoon" },
  { from: 17, to: 21, key: "evening", english: "Good evening" },
  { from: 21, to: 29, key: "night", english: "Up late" }, // 21:00 – 04:59
];

export const HEADLINE = {
  tulu: (name) => (name ? `ಸೊಲ್ಮೆಲು, ${name}!` : "ಸೊಲ್ಮೆಲು!"),
  roman: (name) => (name ? `solmelu, ${name}!` : "solmelu!"),
  english: "Greetings!",
};

/* The question under the headline. `when` limits a line to certain times
   of day; `visit` to "first" or "returning" visits. Leave either out for
   "any". */
export const QUESTIONS = [
  { tulu: "ಎಂಚ ಉಲ್ಲರ್?", roman: "encha ullar?", english: "How are you?" },
  { tulu: "ಎಂಚ ಉಲ್ಲ?", roman: "encha ulla?", english: "How are you? (to a friend)", visit: "returning" },
  { tulu: "ಇನಿ ದಾದ ಕಲ್ಪುವ?", roman: "ini daada kalpuva?", english: "What shall we learn today?", visit: "returning" },
  { tulu: "ಊಟ ಆಂಡಾ?", roman: "oota aanda?", english: "Have you eaten?", when: ["afternoon", "night"], visit: "returning" },
];

/* The English line beside the time of day. */
export const VISIT_LINE = {
  first: (name) => (name ? `Nice to meet you, ${name}` : "Welcome to Tulu Mitra"),
  returning: (name) => (name ? `Welcome back, ${name}` : "Welcome back"),
  longAway: (name) => (name ? `Good to see you again, ${name}` : "Good to see you again"),
};

/* Away at least this many days counts as "long away". */
export const LONG_AWAY_DAYS = 3;

/* First visit, straight after giving a name: how to say it in Tulu. */
export const MY_NAME_IS = {
  tulu: (name) => `ಎನ್ನ ಪುದರ್ ${name}`,
  roman: (name) => `enna pudar ${name}`,
  english: (name) => `My name is ${name}.`,
};

/* The name question on the very first visit. */
export const ASK_NAME = { tulu: "ಈರೆನ ಪುದರ್ ದಾದ?", roman: "eerena pudar daada?", english: "What is your name?" };
