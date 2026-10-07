import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Mic, Square, Upload, X, RotateCcw } from "lucide-react";
import VoiceOrb from "./VoiceOrb";
import AudioButton from "./AudioButton";
import useRecorder from "../hooks/useRecorder";
import useAudioPlayer from "../hooks/useAudioPlayer";
import { hasVoiceSample, isMockMode, prepareVoice, tts, uploadVoice, voiceStatus } from "../services/api";
import { PERSONAL_VOICE, getPreferredVoice, setPreferredVoice } from "../services/indianVoice";

const MIN_S = 6;
const MAX_S = 30;

const READ_ALOUD = "ಎಂಕ್ ಎಡ್ಡೆ ಉಂಡು. ಈರೆಗ್ ಎಂಚ ಉಂಡು?";

/**
 * Optional personalisation. Two ways in — speak now, or upload a clip you
 * already have — and one shared review step before anything is sent.
 */
export default function VoiceUpload() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("record"); // record | upload
  const [phase, setPhase] = useState(() => (hasVoiceSample() ? "ready" : "idle")); // idle | recording | captured | uploading | ready | error
  const [status, setStatus] = useState(null); // what the server says about personalisation
  const [usingMine, setUsingMine] = useState(getPreferredVoice() === PERSONAL_VOICE);
  const [message, setMessage] = useState("");
  const [sample, setSample] = useState(null);
  const [seconds, setSeconds] = useState(0);

  const inputRef = useRef(null);
  const takeRef = useRef(0);
  const recorder = useRecorder();
  const player = useAudioPlayer();

  /* Timer while the microphone is live. */
  useEffect(() => {
    if (phase !== "recording") return undefined;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (recorder.error) {
      setPhase("error");
      setMessage(recorder.error);
    }
  }, [recorder.error]);

  /* Ask the server whether the personalised voice is ready, and keep asking
     while it is still loading models (the first time can take minutes). */
  useEffect(() => {
    if (!open || phase !== "ready") return undefined;
    let alive = true;
    let timer;
    const check = async () => {
      try {
        const s = await voiceStatus();
        if (!alive) return;
        setStatus(s);
        const loading = s?.conversion?.state === "loading" || s?.tts?.state === "loading";
        if (loading) timer = setTimeout(check, 5000);
      } catch {
        if (alive) setStatus({ ready: false, message: "Couldn't reach the backend to check your voice." });
      }
    };
    check();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, phase]);

  const sampleMissing = status?.conversion?.sample?.exists === false;

  const useMine = () => {
    setPreferredVoice(PERSONAL_VOICE);
    setUsingMine(true);
  };

  const prepare = async () => {
    try {
      setStatus(await prepareVoice());
    } catch {
      /* the next status check reports it */
    }
  };

  const reset = () => {
    player.stop();
    setSample((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    setSeconds(0);
    setMessage("");
    setPhase("idle");
  };

  const startRecording = async () => {
    setMessage("");
    setSeconds(0);
    player.stop();
    const ok = await recorder.start();
    if (ok) setPhase("recording");
  };

  const stopRecording = async () => {
    const captured = seconds;
    const blob = await recorder.stop();
    if (!blob) {
      setPhase("error");
      setMessage("Nothing was captured. Check your microphone and try again.");
      return;
    }
    if (captured < MIN_S) {
      setPhase("error");
      setMessage(`That was ${captured}s. Speak for at least ${MIN_S} seconds.`);
      return;
    }
    takeRef.current += 1;
    setSample({
      url: URL.createObjectURL(blob),
      blob,
      name: `Live recording · ${captured}s`,
      take: takeRef.current,
    });
    setPhase("captured");
  };

  /* Hard stop at the maximum length. */
  useEffect(() => {
    if (phase === "recording" && seconds >= MAX_S) stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, phase]);

  const measure = (file) =>
    new Promise((resolve) => {
      const el = document.createElement("audio");
      el.preload = "metadata";
      el.onloadedmetadata = () => resolve(el.duration);
      el.onerror = () => resolve(null);
      el.src = URL.createObjectURL(file);
    });

  const chooseFile = async (file) => {
    if (!file) return;
    const duration = await measure(file);
    if (duration && (duration < MIN_S || duration > MAX_S)) {
      setPhase("error");
      setMessage(
        `Use a clip between ${MIN_S} and ${MAX_S} seconds. This one is ${Math.round(duration)}s.`
      );
      return;
    }
    takeRef.current += 1;
    setSample({
      url: URL.createObjectURL(file),
      blob: file,
      name: file.name,
      take: takeRef.current,
    });
    setMessage("");
    setPhase("captured");
  };

  const submit = async () => {
    if (!sample) return;
    setPhase("uploading");
    try {
      const r = await uploadVoice(sample.blob);
      setStatus(r.status ?? null);
      setPhase("ready");
    } catch {
      setPhase("error");
      setMessage("Unable to process the voice sample.");
    }
  };

  const micStatus =
    recorder.status === "requesting"
      ? "Waiting for microphone permission"
      : phase === "recording"
        ? `Recording · ${seconds}s of ${MAX_S}s`
        : "Press to start recording";

  const showCapture = phase !== "captured" && phase !== "uploading";

  return (
    <div className={`vu ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="vu__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {phase === "ready" ? <Check size={15} /> : <Mic size={15} />}
        <span>{phase === "ready" ? "Voice sample ready" : "Add your voice"}</span>
      </button>

      {open && (
        <div className="vu__panel">
          <div className="vu__head">
            <h3>Personalised voice</h3>
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => setOpen(false)}
              aria-label="Close voice sample panel"
            >
              <X size={16} />
            </button>
          </div>

          <p className="hint">
            Speak for {MIN_S}–{MAX_S} seconds, or upload a clip you already have, to enable
            personalised voice responses. The sample is sent to the Tulu Mitra backend for
            processing.
          </p>

          {phase === "ready" ? (
            <>
              {!sampleMissing && (
                <div className="vu__state vu__state--ok">
                  <Check size={15} /> {sample?.name ?? "Your voice sample"} is saved
                  {isMockMode ? " in this browser." : " on the server."}
                </div>
              )}

              <div className={`vu__status ${status?.ready ? "is-ok" : ""}`} role="status">
                <b>Personalised voice:</b>{" "}
                {status ? status.message : isMockMode ? "" : "Checking the server…"}
                {(status?.conversion?.state === "loading" || status?.tts?.state === "loading") && (
                  <Loader2 size={13} className="spin" />
                )}
                {status?.conversion?.loading_seconds ? ` (${status.conversion.loading_seconds}s so far)` : ""}
              </div>
              <p className="hint">
                This isn't training: the server speaks each answer in its normal voice, then kNN-VC
                converts that speech toward your sample. Nothing is sent anywhere else.
              </p>

              {!isMockMode && (
                <div className="vu__review-row">
                  <AudioButton
                    label="Test my voice"
                    onClick={() => player.play("my-voice-test", () => tts(READ_ALOUD, { personal: true, timeout: 240000 }), READ_ALOUD, { server: true })}
                    playing={player.playingKey === "my-voice-test"}
                    loading={player.loadingKey === "my-voice-test"}
                  />
                  {status && !status.ready && status.conversion?.state !== "loading" && status.conversion?.enabled && (
                    <button type="button" className="btn btn--quiet" onClick={prepare}>
                      Prepare now
                    </button>
                  )}
                </div>
              )}

              {!isMockMode && (
                <button
                  type="button"
                  className={`btn ${usingMine ? "btn--ghost" : "btn--primary"} vu__wide`}
                  onClick={useMine}
                  disabled={usingMine || sampleMissing}
                >
                  {usingMine ? <><Check size={14} /> Answers use my voice</> : "Use my voice for answers"}
                </button>
              )}
              <button type="button" className="btn btn--ghost vu__wide" onClick={reset}>
                <RotateCcw size={14} /> Replace sample
              </button>
            </>
          ) : (
            <>
              <div className="vu__tabs" role="group" aria-label="Voice sample source">
                <button
                  type="button"
                  className={`vu__tab ${tab === "record" ? "is-active" : ""}`}
                  aria-pressed={tab === "record"}
                  onClick={() => {
                    if (phase === "recording") recorder.cancel();
                    setTab("record");
                    reset();
                  }}
                >
                  <Mic size={14} /> Record live
                </button>
                <button
                  type="button"
                  className={`vu__tab ${tab === "upload" ? "is-active" : ""}`}
                  aria-pressed={tab === "upload"}
                  onClick={() => {
                    if (phase === "recording") recorder.cancel();
                    setTab("upload");
                    reset();
                  }}
                >
                  <Upload size={14} /> Upload file
                </button>
              </div>

              {tab === "record" && showCapture && (
                <div className="vu__record">
                  <div className="vu__orb">
                    <VoiceOrb
                      state={phase === "recording" ? "listening" : "idle"}
                      getLevel={recorder.getLevel}
                      size={108}
                    />
                    <button
                      type="button"
                      className={`vu__reccta ${phase === "recording" ? "is-live" : ""}`}
                      onClick={phase === "recording" ? stopRecording : startRecording}
                      aria-label={phase === "recording" ? "Stop recording" : "Start recording"}
                    >
                      {phase === "recording" ? (
                        <Square size={15} fill="currentColor" />
                      ) : (
                        <Mic size={18} />
                      )}
                    </button>
                  </div>

                  <p className={`vu__mic-status ${phase === "recording" ? "is-live" : ""}`}>
                    {phase === "recording" && <span className="vu__rec-dot" />}
                    {micStatus}
                  </p>

                  {phase !== "recording" && (
                    <p className="vu__prompt">
                      Read this aloud in your natural voice
                      <span className="kn">{READ_ALOUD}</span>
                    </p>
                  )}
                </div>
              )}

              {tab === "upload" && showCapture && (
                <button
                  type="button"
                  className="vu__drop"
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload size={17} />
                  <span>Choose an audio file</span>
                  <small>WAV, MP3 or M4A</small>
                </button>
              )}

              {phase === "captured" && sample && (
                <div className="vu__review">
                  <p className="vu__review-name">{sample.name}</p>
                  <div className="vu__review-row">
                    <AudioButton
                      label="Play back"
                      onClick={() => player.play(`sample:${sample.take}`, async () => sample.url)}
                      playing={player.playingKey === `sample:${sample.take}`}
                      loading={player.loadingKey === `sample:${sample.take}`}
                    />
                    <button type="button" className="btn btn--quiet" onClick={reset}>
                      <RotateCcw size={13} /> {tab === "record" ? "Re-record" : "Choose another"}
                    </button>
                  </div>
                  <button type="button" className="btn btn--primary vu__wide" onClick={submit}>
                    Use this voice
                  </button>
                </div>
              )}

              {phase === "uploading" && (
                <div className="vu__state">
                  <Loader2 size={15} className="spin" /> Processing voice sample…
                </div>
              )}

              {phase === "error" && message && <p className="vu__err">{message}</p>}
            </>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            className="sr-only"
            onChange={(e) => chooseFile(e.target.files?.[0])}
          />
        </div>
      )}
    </div>
  );
}
