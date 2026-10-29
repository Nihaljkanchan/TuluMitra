/* ==========================================================================
   API service layer — the ONLY file that knows about the backend.
   Every network shape (URL, payload key, response key) is isolated here so
   the UI never has to change when the Python backend's JSON changes.

   Set VITE_API_URL in .env to talk to the real backend:
       VITE_API_URL=http://localhost:8000
   With no VITE_API_URL, the app runs in mock mode (see ./mock.js) so the
   frontend is demonstrable while the backend is offline.
   ========================================================================== */

import * as mock from "./mock";
import { voiceMode } from "./indianVoice";
import { authToken } from "./auth";

const BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

export const isMockMode = !BASE;

/* --- Response key mapping -------------------------------------------------
   If the backend uses different property names, change them HERE ONLY.
   Each reader accepts a few likely aliases so integration is forgiving.     */
const read = (obj, keys, fallback = undefined) => {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return fallback;
};

const absolute = (url) => {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  return `${BASE}${url.startsWith("/") ? "" : "/"}${url}`;
};

/* The voice sample id from /upload-voice, remembered so later speech can be
   personalised. Kept in this browser only. */
const VOICE_KEY = "tulumitra:voiceId";
const savedVoiceId = () => {
  try {
    return localStorage.getItem(VOICE_KEY);
  } catch {
    return null;
  }
};

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, { body, form, expect = "json", timeout = 45000, method = "POST", headers = {} } = {}) {
  const token = authToken();
  if (token) headers = { Authorization: `Bearer ${token}`, ...headers };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      signal: controller.signal,
      ...(method === "GET" || method === "DELETE"
        ? { headers }
        : form
          ? { body: form, headers }
          : {
              headers: { "Content-Type": "application/json", ...headers },
              body: JSON.stringify(body ?? {}),
            }),
    });
    if (!res.ok) {
      // The backend explains most refusals in {"error": "..."}; pass it on.
      let msg = `Request to ${path} failed`;
      try {
        msg = (await res.json()).error || msg;
      } catch {
        /* not JSON */
      }
      throw new ApiError(msg, res.status);
    }
    if (expect === "blob") return res.blob();
    return res.json();
  } catch (err) {
    if (err.name === "AbortError") throw new ApiError("The request timed out", 408);
    throw err instanceof ApiError ? err : new ApiError(err.message, 0);
  } finally {
    clearTimeout(timer);
  }
}

/* --- POST /chat : text in → Tulu reply + meaning + audio url -------------
   `language` is the language the user typed or spoke in ("english",
   "kannada" or "tulu") so the backend knows what it is reading.
   `context.history` carries the last few turns ({role, text}) so a backend
   that supports multi-turn conversation can use them; one that doesn't
   simply ignores the extra key.                                          */
export async function chat(text, language = "tulu", context = {}) {
  if (isMockMode) return mock.chat(text, language, context);
  const data = await request("/chat", {
    body: {
      text,
      message: text,
      language,
      source_language: language,
      history: context.history ?? [],
      memory: context.memory ?? {},
      voice_id: savedVoiceId(),
      with_audio: Boolean(context.with_audio),
    },
  });
  return {
    text: read(data, ["response", "reply", "text", "tulu_text", "message"], ""),
    lang: "tulu",
    roman: read(data, ["transliteration", "roman", "romanized", "tulu_roman"], null),
    english: read(data, ["english", "english_meaning", "meaning", "translation_en"], null),
    audioUrl: absolute(read(data, ["audio_url", "audioUrl", "audio", "url"], null)),
    lang: read(data, ["lang"], "tulu"),
    blocks: read(data, ["blocks"], []) || [],
    suggestions: read(data, ["suggestions", "follow_ups"], []) || [],
    topic: read(data, ["intent", "topic"], null),
    memory: read(data, ["memory"], null) ?? context.memory ?? {},
    source: read(data, ["source"], null),
  };
}

/* --- POST /asr : audio blob → transcribed text --------------------------- */
export async function asr(blob, language = "tulu") {
  if (isMockMode) return mock.asr(blob, language);
  const form = new FormData();
  form.append("file", blob, "recording.webm");
  form.append("audio", blob, "recording.webm");
  form.append("language", language);
  const data = await request("/asr", { form });
  return { text: read(data, ["text", "transcript", "transcription", "result"], "") };
}

/* --- POST /dictionary : word → frequency + corpus examples --------------- */
export async function dictionary(word) {
  if (isMockMode) return mock.dictionary(word);
  const data = await request("/dictionary", { body: { word, query: word } });
  const examples = read(data, ["examples", "sentences", "results", "matches"], []) || [];
  const result = {
    word: read(data, ["word", "query"], word),
    frequency: Number(read(data, ["frequency", "count", "freq"], 0)) || 0,
    roman: read(data, ["transliteration", "roman", "romanized"], null),
    english: read(data, ["english", "meaning", "gloss"], null),
    examples: examples.map((e) => (typeof e === "string" ? e : read(e, ["sentence", "text"], ""))),
  };
  return {
    ...result,
    found: read(data, ["found"], result.frequency > 0 || result.examples.length > 0),
    card: read(data, ["card"], null),
    fuzzy: !!read(data, ["fuzzy"], false),
    related: read(data, ["related"], []) || [],
    sentences: read(data, ["sentences"], []) || [],
  };
}

/* The browsable word list. Only the demo data has one; a backend can add an
   endpoint for this later. */
export const dictionaryIndex = () => (isMockMode ? mock.dictionaryIndex() : null);

/* --- POST /translate : text + pair → translation ------------------------- */
export async function translate(text, pair) {
  if (isMockMode) return mock.translate(text, pair);
  const data = await request("/translate", {
    body: {
      text,
      source: pair.source,
      target: pair.target,
      language_pair: `${pair.source}-${pair.target}`,
    },
  });
  return {
    text: read(data, ["translation", "translated_text", "text", "result", "output"], ""),
    roman: read(data, ["transliteration", "roman", "romanized"], null),
  };
}

/* --- POST /tts : text → audio -------------------------------------------
   The Voice menu decides the voice. "My voice" sends the uploaded sample's
   id so the server converts the speech to it; other choices don't.
   A server that is still loading a model can take a while, so after
   `timeout` the request is dropped and the caller falls back to the
   browser's voice instead of spinning for ever.                           */
export async function tts(text, { personal, timeout } = {}) {
  if (isMockMode) return mock.tts(text);
  const usePersonal = personal ?? voiceMode().mode === "personal";
  // Converting to your voice runs a second model, so it gets longer.
  timeout ??= usePersonal ? 150000 : 60000;
  const voiceId = usePersonal ? savedVoiceId() : null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${BASE}/tts`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice_id: voiceId }),
    });
    if (!res.ok) throw new ApiError("Could not generate audio", res.status);
    const type = res.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const data = await res.json();
      return {
        audioUrl: absolute(read(data, ["audio_url", "audioUrl", "audio", "url"], null)),
        engine: read(data, ["engine"], null),
        personalised: !!read(data, ["personalised"], false),
        note: usePersonal && !voiceId ? "Upload a voice sample first to use “My voice”." : read(data, ["note"], null),
      };
    }
    return { audioUrl: URL.createObjectURL(await res.blob()) };
  } catch (err) {
    if (err.name === "AbortError") throw new ApiError("The server voice took too long", 408);
    throw err instanceof ApiError ? err : new ApiError(err.message, 0);
  } finally {
    clearTimeout(timer);
  }
}

/* --- GET /voice/status : is the personalised voice ready, and if not, why */
export const hasVoiceSample = () => !!savedVoiceId();

export async function voiceStatus() {
  if (isMockMode) return mock.voiceStatus();
  const id = savedVoiceId();
  return request(`/voice/status?voice_id=${encodeURIComponent(id || "")}`, { method: "GET", timeout: 15000 });
}

export async function prepareVoice() {
  if (isMockMode) return mock.voiceStatus();
  return request("/voice/prepare", { body: { voice_id: savedVoiceId() }, timeout: 15000 });
}

/* --- POST /feedback : a visitor reports a mistake ----------------------- */
export async function sendFeedback(report) {
  if (isMockMode) return mock.sendFeedback(report);
  return request("/feedback", { body: report, timeout: 20000 });
}

/* --- GET /content : lessons and greetings edited on the Admin page ------ */
let contentPromise = null;
export function siteContent() {
  if (isMockMode) return Promise.resolve(null);
  contentPromise ??= request("/content", { method: "GET", timeout: 15000 }).catch(() => {
    contentPromise = null; // try again next time
    return null;
  });
  return contentPromise;
}
export const refreshSiteContent = () => {
  contentPromise = null;
};

/* --- Admin page (needs the backend and ADMIN_PASSWORD) ------------------ */
const ADMIN_KEY = "tulumitra:admin";
export const adminPassword = {
  get: () => {
    try {
      return sessionStorage.getItem(ADMIN_KEY) || "";
    } catch {
      return "";
    }
  },
  set: (v) => {
    try {
      if (v) sessionStorage.setItem(ADMIN_KEY, v);
      else sessionStorage.removeItem(ADMIN_KEY);
    } catch {
      /* the password lasts until the page closes */
    }
  },
};

function admin(path, { method = "GET", body, password } = {}) {
  return request(`/admin${path}`, {
    method,
    body,
    timeout: 30000,
    headers: { "X-Admin-Password": password ?? adminPassword.get() },
  });
}

export const adminApi = {
  login: (password) => admin("/login", { method: "POST", body: {}, password }),
  overview: () => admin("/overview"),
  feedback: (status) => admin(`/feedback${status ? `?status=${status}` : ""}`),
  review: (id, action, final, note) => admin(`/feedback/${id}`, { method: "POST", body: { action, final, note } }),
  get: (name) => admin(`/content/${name}`),
  save: (name, data) => admin(`/content/${name}`, { method: "PUT", body: data }),
  backups: (name) => admin(`/backups/${name}`),
  restore: (name, backup) => admin(`/restore/${name}`, { method: "POST", body: { backup } }),
  async exportCorrections() {
    const res = await fetch(`${BASE}/admin/export/corrections`, {
      headers: { "X-Admin-Password": adminPassword.get() },
    });
    if (!res.ok) throw new ApiError("Export failed", res.status);
    return res.blob();
  },
};

/* --- POST /upload-voice : store a sample for voice cloning --------------- */
export async function uploadVoice(file) {
  if (isMockMode) return mock.uploadVoice(file);
  const form = new FormData();
  form.append("file", file, file.name || "voice-sample.webm");
  form.append("audio", file, file.name || "voice-sample.webm");
  const data = await request("/upload-voice", { form });
  const id = read(data, ["voice_id", "id", "sample_id"], null);
  if (id) {
    try {
      localStorage.setItem(VOICE_KEY, id);
    } catch {
      /* storage blocked — personalisation just won't persist */
    }
  }
  return { ok: true, id, warning: read(data, ["warning"], null), seconds: read(data, ["seconds"], null), status: read(data, ["status"], null) };
}

export { ApiError };

/* --- Accounts: "Continue with Google" ------------------------------------
   Google's button gives a signed ID token; the backend checks it with
   Google and returns its own session token. Everything else about the
   person (chats, name, progress) is saved with /user/data.              */
export const authApi = {
  config: () => (isMockMode ? Promise.resolve({ google: false }) : request("/auth/config", { method: "GET", timeout: 10000 })),
  google: (credential) => request("/auth/google", { body: { credential }, timeout: 20000 }),
  me: () => request("/auth/me", { method: "GET", timeout: 15000 }),
  getData: () => request("/user/data", { method: "GET", timeout: 20000 }),
  putData: (data) => request("/user/data", { method: "PUT", body: data, timeout: 20000 }),
  deleteAccount: () => request("/user", { method: "DELETE", timeout: 20000 }),
  /* For closing the tab: a request that finishes even as the page unloads. */
  putDataOnExit(data) {
    const token = authToken();
    if (!token || isMockMode) return;
    try {
      fetch(`${BASE}/user/data`, {
        method: "PUT",
        keepalive: true,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    } catch {
      /* the regular sync already saved most of it */
    }
  },
};
