import { useCallback, useEffect, useRef, useState } from "react";
import { speak, stopSpeaking, voiceMode } from "../services/indianVoice";
import { useToast } from "../components/Toast";

/**
 * One audio element for the whole page: starting a new clip always stops the
 * previous one, so two "Speaking" states can never run at once.
 *
 * play(key, resolve, speakText, { server })
 *   resolve    async function returning an audio URL, or {audioUrl, note}
 *              (usually a /tts call), so a button can show "Generating audio"
 *   speakText  the text itself, for the browser-voice fallback
 *   server     ask the server even if a computer voice is chosen (used by
 *              "Test my voice")
 *
 * Which voice is used follows the Voice menu (services/indianVoice.js):
 *   • one of this computer's voices → spoken in the browser straight away,
 *     the server isn't asked at all;
 *   • server / my voice / automatic → the server's audio; if the server has
 *     no speech model, is too slow or fails, the best Indian voice on this
 *     computer speaks instead and a short note says why.
 * Audio is cached per voice choice, so changing the voice takes effect on
 * the very next play.
 */
export default function useAudioPlayer() {
  const [playingKey, setPlayingKey] = useState(null);
  const [loadingKey, setLoadingKey] = useState(null);
  const [error, setError] = useState(null);
  const notify = useToast();

  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const cacheRef = useRef(new Map());
  const tokenRef = useRef(0);
  const noticeRef = useRef(new Set()); // each note is shown once per page

  if (!audioRef.current && typeof Audio !== "undefined") audioRef.current = new Audio();

  const reset = useCallback(() => {
    tokenRef.current += 1;
    clearTimeout(timerRef.current);
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    stopSpeaking();
    setPlayingKey(null);
    setLoadingKey(null);
  }, []);

  useEffect(() => reset, [reset]);

  const tell = useCallback(
    (msg) => {
      if (!msg || noticeRef.current.has(msg)) return;
      noticeRef.current.add(msg);
      notify(msg, "info");
    },
    [notify]
  );

  const play = useCallback(
    async (key, resolve, speakText, { server = false } = {}) => {
      setError(null);
      if (playingKey === key || loadingKey === key) {
        reset();
        return false;
      }
      reset();
      const token = tokenRef.current;
      const { mode, uri } = voiceMode();

      const browserSpeak = () => {
        setPlayingKey(key);
        speak(speakText, {
          voiceURI: mode === "browser" ? uri : undefined,
          onEnd: () => setPlayingKey((k) => (k === key ? null : k)),
        });
        return true;
      };

      // A voice from this computer was chosen: no server round trip.
      if (mode === "browser" && !server && speakText && window.speechSynthesis) return browserSpeak();

      const cacheKey = `${server ? "server" : mode}|${key}`;
      let url = cacheRef.current.get(cacheKey);
      if (url === undefined) {
        setLoadingKey(key);
        try {
          const r = await resolve();
          const res = typeof r === "string" || r == null ? { audioUrl: r ?? null } : r;
          url = res.audioUrl ?? null;
          if (res.note) tell(res.note);
          cacheRef.current.set(cacheKey, url);
        } catch (err) {
          if (token !== tokenRef.current) return false;
          setLoadingKey(null);
          if (speakText && window.speechSynthesis) {
            tell(
              err?.status === 408
                ? "The server voice took too long (it may still be loading), so this computer's voice was used."
                : "The server voice isn't available right now, so this computer's voice was used."
            );
            return browserSpeak();
          }
          setError("Audio could not be generated. Please try again.");
          return false;
        }
        if (token !== tokenRef.current) return false; // stopped while loading
        setLoadingKey(null);
      }

      if (!url) {
        // The server made no audio (demo mode or no speech model).
        if (speakText && window.speechSynthesis) return browserSpeak();
        setPlayingKey(key);
        timerRef.current = setTimeout(() => setPlayingKey(null), 1800);
        return true;
      }

      setPlayingKey(key);
      const el = audioRef.current;
      el.src = url;
      el.onended = () => setPlayingKey(null);
      el.onerror = () => {
        cacheRef.current.delete(cacheKey);
        setPlayingKey(null);
        setError("Audio could not be played.");
      };
      try {
        await el.play();
      } catch {
        cacheRef.current.delete(cacheKey);
        setPlayingKey(null);
        setError("Audio could not be played.");
        return false;
      }
      return true;
    },
    [playingKey, loadingKey, reset, tell]
  );

  return {
    play,
    stop: reset,
    playingKey,
    loadingKey,
    error,
    clearError: () => setError(null),
    isBusy: Boolean(playingKey || loadingKey),
  };
}
