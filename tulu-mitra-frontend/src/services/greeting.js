import { HEADLINE, LONG_AWAY_DAYS, QUESTIONS, TIME_OF_DAY, VISIT_LINE } from "../data/greetings";

const DAY = 24 * 60 * 60 * 1000;

/* The built-in greetings, or the ones edited on the Admin page (GET /content). */
function source(remote) {
  if (!remote?.questions?.length) {
    return { tod: TIME_OF_DAY, questions: QUESTIONS, headline: null, lines: null, awayDays: LONG_AWAY_DAYS };
  }
  return {
    tod: remote.time_of_day?.length ? remote.time_of_day : TIME_OF_DAY,
    questions: remote.questions.map((q) => ({
      ...q,
      when: q.when?.length ? q.when : undefined,
      visit: q.visit || undefined,
    })),
    headline: remote.headline,
    lines: remote.visit_lines,
    awayDays: remote.long_away_days ?? LONG_AWAY_DAYS,
  };
}

export function timeOfDay(date = new Date(), tod = TIME_OF_DAY) {
  const h = date.getHours();
  const hour = h < 5 ? h + 24 : h;
  return tod.find((t) => hour >= t.from && hour < t.to) ?? tod[0];
}

const fill = (template, name) =>
  name ? template.replace("{name}", name) : template.replace(/,?\s*\{name\}/, "");

/**
 * The welcome greeting for this profile at this time.
 * The question is chosen from the lines that fit, and changes from visit to
 * visit (it is picked by visit number, so it does not flicker on re-render).
 */
export function buildGreeting(profile, date = new Date(), remote = null) {
  const src = source(remote);
  const name = profile.name || "";
  const tod = timeOfDay(date, src.tod);
  const returning = profile.visits > 1;
  const away = profile.prevVisit ? (date.getTime() - profile.prevVisit) / DAY : 0;

  const visitKind = returning ? "returning" : "first";
  const fits = src.questions.filter(
    (q) => (!q.when || q.when.includes(tod.key)) && (!q.visit || q.visit === visitKind)
  );
  const pool = fits.length ? fits : src.questions;
  const question = pool[(profile.visits + date.getDate()) % pool.length];

  const kind = !returning ? "first" : away >= src.awayDays ? "long_away" : "returning";
  const line = src.lines?.[kind]
    ? fill(src.lines[kind], name)
    : { first: VISIT_LINE.first, returning: VISIT_LINE.returning, long_away: VISIT_LINE.longAway }[kind](name);

  const head = src.headline?.tulu;
  const headRoman = src.headline?.roman;
  return {
    lead: `${tod.english} · ${line}`,
    headline: {
      tulu: head ? (name ? `${head}, ${name}!` : `${head}!`) : HEADLINE.tulu(name),
      roman: headRoman ? (name ? `${headRoman}, ${name}!` : `${headRoman}!`) : HEADLINE.roman(name),
      english: src.headline?.english || HEADLINE.english,
    },
    question,
    returning,
  };
}
