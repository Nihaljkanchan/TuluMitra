/* ==========================================================================
   Light / dark theme.

   The choice is kept in this browser. With no saved choice the site follows
   the computer's setting. index.html applies the theme before the page
   draws (the same logic, inlined), so there is no flash of the wrong one.
   ========================================================================== */

const KEY = "tulumitra:theme";

export function savedTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

export function systemTheme() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export const currentTheme = () => document.documentElement.dataset.theme || savedTheme() || systemTheme();

export function applyTheme(theme, { animate = false } = {}) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add("theme-anim");
    setTimeout(() => root.classList.remove("theme-anim"), 350);
  }
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#13111a" : "#3c3489");
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage blocked — the choice lasts until the page closes */
  }
  applyTheme(theme, { animate: true });
}

/* Follow the computer's setting live, until the viewer picks one here. */
export function followSystem(onChange) {
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (!mq) return () => {};
  const handler = () => {
    if (savedTheme()) return;
    const t = mq.matches ? "dark" : "light";
    applyTheme(t, { animate: true });
    onChange?.(t);
  };
  mq.addEventListener?.("change", handler);
  return () => mq.removeEventListener?.("change", handler);
}
