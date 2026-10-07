/* ==========================================================================
   Keeps a signed-in person's data on the server, so it follows them to any
   device — like signing in to Claude.

   Saved: chats, the name they are greeted by (and visit count), and Learn
   progress. These live in this browser's localStorage while the site is
   open; this module copies them up every few seconds when something
   changed, and on sign-in merges what the server has with what is here.
   ========================================================================== */

import { authApi } from "./api";
import { getAuth, setAuth } from "./auth";

const KEYS = {
  chats: "tulumitra:chats:v1",
  profile: "tulumitra:profile",
  progress: "tulu-mitra:listened",
};
const MAX_CHATS = 60;

const read = (k, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(k) || "null") ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage full or blocked */
  }
};

export function snapshot() {
  return {
    chats: read(KEYS.chats, []),
    profile: read(KEYS.profile, {}),
    progress: read(KEYS.progress, []),
  };
}

/* The newer copy of each chat wins; chats only on one side are kept. */
function mergeChats(local = [], remote = []) {
  const byId = new Map();
  for (const c of [...remote, ...local]) {
    if (!c?.id) continue;
    const had = byId.get(c.id);
    if (!had || (c.updatedAt ?? 0) >= (had.updatedAt ?? 0)) byId.set(c.id, c);
  }
  return [...byId.values()].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).slice(0, MAX_CHATS);
}

function mergeProfile(local = {}, remote = {}, googleName = "") {
  const visits = Math.max(local.visits || 0, remote.visits || 0);
  return {
    ...remote,
    ...local,
    name: local.name || remote.name || googleName || "",
    asked: true,
    visits,
    lastVisit: Math.max(local.lastVisit || 0, remote.lastVisit || 0) || null,
    prevVisit: Math.max(local.prevVisit || 0, remote.prevVisit || 0) || null,
  };
}

let lastPushed = "";

/* After signing in: combine the server's copy with this browser's. */
export async function pullAndMerge(user) {
  const { data = {} } = await authApi.getData();
  const here = snapshot();
  const merged = {
    chats: mergeChats(here.chats, data.chats),
    profile: mergeProfile(here.profile, data.profile, user?.given_name || user?.name?.split(" ")[0]),
    progress: [...new Set([...(data.progress || []), ...(here.progress || [])])],
  };
  write(KEYS.chats, merged.chats);
  write(KEYS.profile, merged.profile);
  write(KEYS.progress, merged.progress);
  window.dispatchEvent(new CustomEvent("tulumitra:profile", { detail: merged.profile }));
  lastPushed = "";
  await push();
}

export async function push() {
  if (getAuth()?.mode !== "google") return;
  const data = snapshot();
  const text = JSON.stringify(data);
  if (text === lastPushed) return;
  try {
    await authApi.putData(data);
    lastPushed = text;
  } catch (err) {
    if (err?.status === 401) setAuth(null); // session expired: sign in again
  }
}

/* Save changes every few seconds, and when the tab is hidden or closed. */
export function startSync() {
  const timer = setInterval(push, 4000);
  const onHide = () => {
    if (document.visibilityState !== "hidden") return;
    const data = snapshot();
    const text = JSON.stringify(data);
    if (text !== lastPushed) {
      authApi.putDataOnExit(data);
      lastPushed = text;
    }
  };
  document.addEventListener("visibilitychange", onHide);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onHide);
  };
}

/* Sign out: save one last time, then remove this person's data from this
   browser, so the next person using the computer doesn't see it. */
export async function signOut() {
  await push();
  for (const k of Object.values(KEYS)) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  lastPushed = "";
  setAuth(null);
}

export async function deleteAccount() {
  await authApi.deleteAccount();
  lastPushed = "";
  for (const k of Object.values(KEYS)) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  setAuth(null);
}
