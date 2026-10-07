/* ==========================================================================
   Who is using the site in this browser:
     { mode: "google", token, user }  signed in with Google (token = the
                                      backend's session, valid 30 days)
     { mode: "guest" }                chose "Continue without signing in"
     null                             hasn't chosen yet → the login page
   ========================================================================== */

const KEY = "tulumitra:auth";

export function getAuth() {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || "null");
    return a && (a.mode === "guest" || (a.mode === "google" && a.token)) ? a : null;
  } catch {
    return null;
  }
}

export function setAuth(auth) {
  try {
    if (auth) localStorage.setItem(KEY, JSON.stringify(auth));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked — lasts until the page closes */
  }
  window.dispatchEvent(new CustomEvent("tulumitra:auth", { detail: auth }));
}

export const authToken = () => {
  const a = getAuth();
  return a?.mode === "google" ? a.token : "";
};

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
