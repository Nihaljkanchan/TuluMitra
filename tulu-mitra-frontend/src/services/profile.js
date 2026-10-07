/* ==========================================================================
   The visitor's name and visit history, kept only in this browser
   (localStorage). Nothing here is sent anywhere except the name, which is
   passed to the assistant with each chat so it can use it in replies.
   ========================================================================== */

const KEY = "tulumitra:profile";
const SESSION_KEY = "tulumitra:visit-counted";

const EMPTY = { name: "", asked: false, visits: 0, lastVisit: null, prevVisit: null };

export function getProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "null");
    return p && typeof p === "object" ? { ...EMPTY, ...p } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

function store(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage blocked — the name lasts until the page closes */
  }
  window.dispatchEvent(new CustomEvent("tulumitra:profile", { detail: p }));
  return p;
}

/* Tidy a typed name: trim, collapse spaces, capitalise Latin words. */
export function cleanName(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30)
    .replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

export const saveName = (name) => store({ ...getProfile(), name: cleanName(name), asked: true });

/* "Skip" still counts as asked, so the question isn't repeated every visit. */
export const skipName = () => store({ ...getProfile(), asked: true });

/**
 * Count this visit once per browser session (not on every page change),
 * and return the profile as it now stands. prevVisit is when they were
 * last here before today's visit — used for "welcome back".
 */
export function recordVisit() {
  const p = getProfile();
  let counted = false;
  try {
    counted = sessionStorage.getItem(SESSION_KEY) === "1";
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* no session storage — count every load */
  }
  if (counted) return p;
  const now = Date.now();
  return store({ ...p, visits: p.visits + 1, prevVisit: p.lastVisit, lastVisit: now });
}
