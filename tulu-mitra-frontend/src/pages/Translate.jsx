import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import Segmented from "../components/Segmented";
import AudioButton from "../components/AudioButton";
import { translate, tts } from "../services/api";
import useAudioPlayer from "../hooks/useAudioPlayer";
import { useToast } from "../components/Toast";
import ReportMistake from "../components/ReportMistake";

const PAIRS = [
  { id: "en-tulu", label: "English → Tulu", source: "english", target: "tulu" },
  { id: "kn-tulu", label: "Kannada → Tulu", source: "kannada", target: "tulu" },
  { id: "tulu-en", label: "Tulu → English", source: "tulu", target: "english" },
  { id: "tulu-kn", label: "Tulu → Kannada", source: "tulu", target: "kannada" },
];

export default function Translate() {
  const [pairId, setPairId] = useState("en-tulu");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [roman, setRoman] = useState(null);
  const [asked, setAsked] = useState("");
  const [loading, setLoading] = useState(false);
  const player = useAudioPlayer();
  const notify = useToast();

  const pair = PAIRS.find((p) => p.id === pairId);
  const tuluOut = pair.target === "tulu";

  const clear = (id) => { setPairId(id); setOutput(""); setRoman(null); };

  const run = async () => {
    const text = input.trim();
    if (!text) return;
    setLoading(true);
    setOutput("");
    setRoman(null);
    player.stop();
    try {
      const data = await translate(text, pair);
      setOutput(data.text);
      setRoman(data.roman ?? null);
      setAsked(text);
    } catch {
      notify("Translation could not be completed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Tulu translation</h1>
        <p>Translate between Tulu, English and Kannada, and hear the Tulu spoken aloud.
          Tulu results include a Latin-letter reading for learners.</p>
      </header>

      <Segmented options={PAIRS} value={pairId} onChange={clear} label="Language pair" scroll />

      <div className="tr">
        <div className="tr__panel">
          <label className="tr__label" htmlFor="tr-in">{pair.source} text</label>
          <textarea id="tr-in" className={`tr__area ${pair.source === "english" ? "" : "kn"}`}
            value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter text…" />
          <div className="tr__foot">
            <span className="hint">{input.length} characters</span>
            <button type="button" className="btn btn--primary" onClick={run}
              disabled={!input.trim() || loading}>
              {loading ? <><Loader2 size={16} className="spin" /> Translating</> : "Translate"}
            </button>
          </div>
        </div>

        <div className="tr__arrow" aria-hidden="true"><ArrowRight size={18} /></div>

        <div className="tr__panel tr__panel--out">
          <label className="tr__label">{pair.target} translation</label>
          <div className={`tr__out ${pair.target === "english" ? "" : "kn"}`}>
            {loading ? (
              <>
                <div className="skeleton" style={{ height: 15, width: "78%" }} />
                <div className="skeleton" style={{ height: 15, width: "54%", marginTop: 10 }} />
              </>
            ) : output ? (
              output
            ) : (
              <span className="tr__placeholder">Translation will appear here…</span>
            )}
          </div>

          {output && roman && <p className="tr__roman">{roman}</p>}

          {output && !loading && (
            <div className="tr__foot">
              {tuluOut ? (
                <AudioButton
                  onClick={() => player.play(`tr:${output}`, () => tts(output), output)}
                  playing={player.playingKey === `tr:${output}`}
                  loading={player.loadingKey === `tr:${output}`} />
              ) : <span />}
              <ReportMistake
                kind="translation"
                page="translate"
                input={asked}
                direction={`${pair.source}-${pair.target}`}
                shown={tuluOut ? { tulu: /[ಀ-೿]/.test(output) ? output : "", roman: roman || "", english: pair.source === "english" ? asked : "" }
                  : { tulu: pair.source === "tulu" ? asked : "", english: output }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
