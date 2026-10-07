import { useEffect, useRef, useState } from "react";
import { AudioLines, Check, Play, Server, Square, UserRound } from "lucide-react";
import {
  KIND_LABEL,
  PERSONAL_VOICE,
  SERVER_VOICE,
  getPreferredVoice,
  indianVoices,
  setPreferredVoice,
  speak,
  stopSpeaking,
  voiceKind,
} from "../services/indianVoice";
import { hasVoiceSample, isMockMode, tts, voiceStatus } from "../services/api";
import useAudioPlayer from "../hooks/useAudioPlayer";
import AudioButton from "./AudioButton";

const SAMPLE = "ಸೊಲ್ಮೆಲು! ಎಂಚ ಉಲ್ಲರ್? ಎಂಕ್ ಎಡ್ಡೆ ಉಂಡು.";

/**
 * Which voice reads Tulu aloud, for every play button on the site.
 *   Automatic      server voice if it makes audio, else this computer's best
 *   Server voice   the backend's speech model
 *   My voice       the backend's speech converted to your uploaded sample
 *   a computer voice — spoken in the browser, the server is not asked
 * "Test the chosen voice" plays through exactly the same path as Learn.
 */
export default function VoiceMenu() {
  const [open, setOpen] = useState(false);
  const [voices, setVoices] = useState(null); // null = still loading
  const [chosen, setChosen] = useState(getPreferredVoice());
  const [testing, setTesting] = useState(null);
  const [status, setStatus] = useState(null);
  const wrapRef = useRef(null);
  const player = useAudioPlayer();

  useEffect(() => {
    const on = (e) => setChosen(e.detail ?? getPreferredVoice());
    window.addEventListener("tulumitra:voice", on);
    return () => window.removeEventListener("tulumitra:voice", on);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    indianVoices().then((v) => alive && setVoices(v));
    if (!isMockMode && hasVoiceSample())
      voiceStatus()
        .then((s) => alive && setStatus(s))
        .catch(() => alive && setStatus({ ready: false, message: "Couldn't reach the backend to check your voice." }));
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (uri) => {
    player.stop();
    setChosen(uri);
    setPreferredVoice(uri);
  };

  const test = (uri) => {
    player.stop();
    if (testing === uri) {
      stopSpeaking();
      setTesting(null);
      return;
    }
    setTesting(uri);
    speak(SAMPLE, { voiceURI: uri || undefined, onEnd: () => setTesting((t) => (t === uri ? null : t)) });
  };

  const browserVoice = voices?.find((v) => v.voiceURI === chosen);
  const best = voices?.[0];
  const nowUsing =
    chosen === SERVER_VOICE
      ? "Tulu Mitra server voice"
      : chosen === PERSONAL_VOICE
        ? "My voice (personalised on the server)"
        : browserVoice
          ? browserVoice.name
          : isMockMode
            ? `Automatic — ${best?.name ?? "this computer's default voice"}`
            : `Automatic — server voice, or ${best?.name ?? "this computer's voice"} if the server has none`;

  const Option = ({ value, id, icon, name, desc, disabled, children }) => (
    <li>
      <label className={`vm__opt ${chosen === value ? "is-on" : ""} ${disabled ? "is-disabled" : ""}`}>
        <input type="radio" name="tm-voice" id={id} checked={chosen === value} disabled={disabled} onChange={() => choose(value)} />
        {icon}
        <span className="vm__name">
          {name}
          {desc && <em>{desc}</em>}
        </span>
        {children ?? (chosen === value && <Check size={14} />)}
      </label>
    </li>
  );

  return (
    <div className="vm" ref={wrapRef}>
      <button
        type="button"
        className={`vm__trigger ${open ? "is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Voice for Tulu audio"
        aria-label="Voice for Tulu audio"
      >
        <AudioLines size={16} />
        <span className="vm__label">Voice</span>
      </button>

      {open && (
        <div className="vm__panel" role="dialog" aria-label="Voice for Tulu audio">
          <h3>Voice for Tulu audio</h3>
          <p className="vm__now">
            Now using: <b>{nowUsing}</b>
          </p>

          <ul className="vm__list">
            <Option value="" id="tm-voice-auto" name="Automatic" desc="best available" />
          </ul>

          {!isMockMode && (
            <>
              <p className="vm__group">From the Tulu Mitra server</p>
              <ul className="vm__list">
                <Option value={SERVER_VOICE} id="tm-voice-server" icon={<Server size={14} />} name="Tulu Mitra voice" desc="the backend's speech model" />
                <Option
                  value={PERSONAL_VOICE}
                  id="tm-voice-personal"
                  icon={<UserRound size={14} />}
                  name="My voice"
                  desc={hasVoiceSample() ? "speech converted to your uploaded sample" : "upload a sample first (“Add your voice” on Home)"}
                  disabled={!hasVoiceSample()}
                />
              </ul>
              {hasVoiceSample() && status && (
                <p className={`vm__status ${status.ready ? "is-ok" : ""}`}>{status.message}</p>
              )}
            </>
          )}

          <p className="vm__group">This computer's voices</p>
          {voices === null && <p className="vm__hint">Looking for voices…</p>}

          {voices && voices.length === 0 && (
            <div className="vm__none">
              <b>No Indian voice on this computer</b>, so Tulu is read in a Latin spelling by the
              default voice. To get an Indian voice:
              <ul>
                <li>
                  Open this site in <b>Microsoft Edge</b>: it has natural Kannada voices built in.
                </li>
                <li>
                  Or in Windows: <b>Settings → Time &amp; language → Speech → Add voices</b>, add
                  <b> Hindi (India)</b> or <b>English (India)</b>, then restart the browser.
                </li>
              </ul>
            </div>
          )}

          {voices && voices.length > 0 && (
            <ul className="vm__list">
              {voices.map((v, i) => (
                <Option key={v.voiceURI} value={v.voiceURI} id={`tm-voice-${i}`} name={v.name} desc={KIND_LABEL[voiceKind(v)]}>
                  <button
                    type="button"
                    className="vm__test"
                    onClick={(e) => {
                      e.preventDefault();
                      test(v.voiceURI);
                    }}
                    aria-label={testing === v.voiceURI ? "Stop" : `Test ${v.name}`}
                  >
                    {testing === v.voiceURI ? <Square size={11} fill="currentColor" /> : <Play size={12} />}
                  </button>
                </Option>
              ))}
            </ul>
          )}

          <div className="vm__try">
            <AudioButton
              label="Test the chosen voice"
              onClick={() => {
                stopSpeaking();
                setTesting(null);
                player.play("vm-test", () => tts(SAMPLE), SAMPLE);
              }}
              playing={player.playingKey === "vm-test"}
              loading={player.loadingKey === "vm-test"}
            />
          </div>
          <p className="vm__hint">
            Your choice is used by every play button — Home, Learn, Dictionary and Translate. Best
            computer voice: <b>Kannada</b> (Microsoft Edge).
          </p>
        </div>
      )}
    </div>
  );
}
