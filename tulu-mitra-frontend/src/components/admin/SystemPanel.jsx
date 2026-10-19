import { useCallback, useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { adminApi, refreshSiteContent } from "../../services/api";
import { useToast } from "../Toast";

const DATASETS = [
  ["lexicon", "Word list"],
  ["lessons", "Lessons"],
  ["greetings", "Greetings"],
  ["corrections", "Corrections"],
];

const Row = ({ label, value, ok }) => (
  <div className="adm-stat">
    <span>{label}</span>
    <b className={ok === true ? "is-ok" : ok === false ? "is-warn" : ""}>{value}</b>
  </div>
);

/** What the backend is running, and restoring earlier versions of the data. */
export default function SystemPanel() {
  const [o, setO] = useState(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("lexicon");
  const [list, setList] = useState([]);
  const notify = useToast();

  const load = useCallback(async () => {
    try {
      setO(await adminApi.overview());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    adminApi
      .backups(name)
      .then((r) => setList(r.items))
      .catch(() => setList([]));
  }, [name]);

  const restore = async (b) => {
    if (!window.confirm(`Replace the current ${name} with the version saved as ${b}? (The current one is backed up first.)`)) return;
    try {
      await adminApi.restore(name, b);
      refreshSiteContent();
      notify("Restored. The website uses it now.", "info");
      load();
      adminApi.backups(name).then((r) => setList(r.items));
    } catch (e) {
      notify(e.message || "Restore failed");
    }
  };

  const vc = o?.voice_conversion;
  return (
    <section>
      {error && <p className="vu__err">{error}</p>}
      {o && (
        <div className="adm-stats">
          <Row label="Reports waiting" value={o.feedback.pending} />
          <Row label="Corrections in use" value={o.feedback.corrections} />
          <Row label="Word-list entries" value={o.lexicon_entries.toLocaleString()} />
          <Row label="Lessons / phrases" value={`${o.lesson_categories} / ${o.lesson_items}`} />
          <Row label="Corpus sentences" value={o.corpus_sentences.toLocaleString()} />
          <Row label="Speech output (TTS)" value={o.tts.engine ? `${o.tts.engine} · ${o.tts.state}` : o.tts.state} ok={!!o.tts.engine} />
          <Row label="Speech input (ASR)" value={o.asr.state ?? "—"} />
          <Row
            label="Personalised voice"
            value={!vc.enabled ? "off (VOICE_CONVERSION=off)" : vc.error ? `error: ${vc.error}` : vc.state}
            ok={vc.enabled ? vc.state === "ready" : undefined}
          />
          <Row
            label="Language model (open questions)"
            value={
              (typeof o.llm === "object" ? o.llm.enabled : o.llm)
                ? `${o.llm.provider || "on"}${o.llm.model ? ` · ${o.llm.model}` : ""}`
                : "off"
            }
            ok={(typeof o.llm === "object" ? o.llm.enabled : o.llm) || undefined}
          />
          <Row label="Training export" value={o.training_file} />
        </div>
      )}

      <h3 className="adm-h3">
        <History size={16} /> Earlier versions
      </h3>
      <p className="adm-intro">Every save keeps the previous version (the last 30 of each). Restore one if an edit went wrong.</p>
      <div className="adm-filters">
        {DATASETS.map(([id, label]) => (
          <button key={id} type="button" className={`adm-filter ${name === id ? "is-on" : ""}`} onClick={() => setName(id)}>
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="adm-empty">No earlier versions yet.</p>
      ) : (
        <ul className="adm-backups">
          {list.map((b) => (
            <li key={b}>
              <code>{b}</code>
              <button type="button" className="btn btn--quiet" onClick={() => restore(b)}>
                <RotateCcw size={14} /> Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
