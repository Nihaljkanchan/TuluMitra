import { useState } from "react";
import { Braces, Loader2, RotateCcw, Save } from "lucide-react";

/** Save / discard bar shown at the top of every editor. */
export function SaveBar({ ds, children }) {
  return (
    <div className="adm-bar">
      <div className="adm-bar__left">{children}</div>
      <div className="adm-bar__right">
        {ds.dirty && <span className="adm-dirty">Unsaved changes</span>}
        <button type="button" className="btn btn--quiet" onClick={ds.reload} disabled={!ds.dirty || ds.saving}>
          <RotateCcw size={14} /> Discard
        </button>
        <button type="button" className="btn btn--primary" onClick={() => ds.save()} disabled={!ds.dirty || ds.saving}>
          {ds.saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Save
        </button>
      </div>
    </div>
  );
}

/** "Edit as JSON": the whole file as text, for anything the tables don't cover. */
export function JsonEditor({ ds }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  const start = () => {
    setText(JSON.stringify(ds.data, null, 2));
    setErr("");
    setOpen(true);
  };

  const apply = () => {
    try {
      ds.setData(JSON.parse(text));
      setOpen(false);
    } catch (e) {
      setErr(`Not valid JSON: ${e.message}`);
    }
  };

  if (!open)
    return (
      <button type="button" className="btn btn--quiet adm-json-btn" onClick={start}>
        <Braces size={14} /> Edit as JSON
      </button>
    );

  return (
    <div className="adm-json">
      <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="JSON" />
      {err && <p className="vu__err">{err}</p>}
      <div className="adm-json__acts">
        <button type="button" className="btn btn--quiet" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" onClick={apply}>
          Apply (then Save)
        </button>
      </div>
    </div>
  );
}

export function Loading({ ds }) {
  if (ds.data) return null;
  return ds.error ? <p className="vu__err">{ds.error}</p> : <p className="hint">Loading…</p>;
}

export const Cell = ({ value, onChange, kn, placeholder, type = "text", width }) => (
  <input
    className={`adm-cell ${kn ? "kn" : ""}`}
    value={value ?? ""}
    type={type}
    placeholder={placeholder}
    style={width ? { width } : undefined}
    onChange={(e) => onChange(e.target.value)}
  />
);
