import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, RotateCcw, Trash2, X } from "lucide-react";
import { adminApi, refreshSiteContent } from "../../services/api";
import { useToast } from "../Toast";

const FILTERS = [
  { id: "pending", label: "Waiting" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "", label: "All" },
];

const KIND = { chat: "Chat reply", translation: "Translation", dictionary: "Dictionary", lesson: "Lesson", other: "Other" };

const when = (s) => new Date(s * 1000).toLocaleString();

function Report({ r, onDone }) {
  const [fix, setFix] = useState(r.final ?? r.suggested);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const notify = useToast();

  const act = async (action) => {
    if (action === "delete" && !window.confirm("Delete this report for good?")) return;
    setBusy(action);
    setErr("");
    try {
      const res = await adminApi.review(r.id, action, action === "approve" ? fix : undefined);
      refreshSiteContent();
      notify(
        action === "approve"
          ? "Approved. The corrected words are used everywhere from now on."
          : action === "reject"
            ? "Rejected."
            : action === "reopen"
              ? "Moved back to waiting."
              : "Deleted.",
        "info"
      );
      onDone(res.counts);
    } catch (e) {
      setErr(e.message || "That didn't work.");
    } finally {
      setBusy(null);
    }
  };

  const set = (k) => (e) => setFix((f) => ({ ...f, [k]: e.target.value }));
  const pending = r.status === "pending";

  return (
    <article className={`adm-report is-${r.status}`}>
      <header className="adm-report__head">
        <span className="adm-tag">{KIND[r.kind] ?? r.kind}</span>
        {r.status !== "pending" && <span className={`adm-tag adm-tag--${r.status}`}>{r.status}</span>}
        <span className="hint">
          {when(r.created)}
          {r.reporter ? ` · from ${r.reporter}` : ""}
          {r.page ? ` · ${r.page} page` : ""}
        </span>
      </header>

      {r.input && (
        <p className="adm-report__input">
          <span>{r.kind === "translation" ? `Text (${r.direction || "translation"})` : r.kind === "dictionary" ? "Searched" : "Asked"}:</span>{" "}
          <b className={/[ಀ-೿]/.test(r.input) ? "kn" : ""}>{r.input}</b>
        </p>
      )}

      <div className="adm-report__cols">
        <div className="adm-report__col">
          <h4>The site showed</h4>
          {r.shown?.tulu && <p className="kn">{r.shown.tulu}</p>}
          {r.shown?.roman && <p className="hint">{r.shown.roman}</p>}
          {r.shown?.english && <p>{r.shown.english}</p>}
          {!r.shown?.tulu && !r.shown?.english && <p className="hint">—</p>}
        </div>
        <div className="adm-report__col adm-report__col--fix">
          <h4>{pending ? "Correct version (you can edit before approving)" : "Correct version"}</h4>
          <label>
            <span>Tulu</span>
            <input className="kn" value={fix.tulu ?? ""} onChange={set("tulu")} disabled={!pending} />
          </label>
          <label>
            <span>Latin letters</span>
            <input value={fix.roman ?? ""} onChange={set("roman")} disabled={!pending} />
          </label>
          <label>
            <span>English</span>
            <input value={fix.english ?? ""} onChange={set("english")} disabled={!pending} />
          </label>
        </div>
      </div>

      {r.note && (
        <p className="adm-report__note">
          <span>Note:</span> {r.note}
        </p>
      )}
      {err && <p className="vu__err">{err}</p>}

      <footer className="adm-report__acts">
        {pending ? (
          <>
            <button type="button" className="btn btn--primary" onClick={() => act("approve")} disabled={!!busy}>
              {busy === "approve" ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Approve
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => act("reject")} disabled={!!busy}>
              <X size={15} /> Reject
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--ghost" onClick={() => act("reopen")} disabled={!!busy}>
            <RotateCcw size={14} /> {r.status === "approved" ? "Undo approval" : "Reopen"}
          </button>
        )}
        <button type="button" className="btn btn--quiet adm-danger" onClick={() => act("delete")} disabled={!!busy}>
          <Trash2 size={14} /> Delete
        </button>
      </footer>
    </article>
  );
}

export default function ReportsPanel({ onCounts }) {
  const [filter, setFilter] = useState("pending");
  const [items, setItems] = useState(null);
  const [counts, setCounts] = useState({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const r = await adminApi.feedback(filter);
      setItems(r.items);
      setCounts(r.counts);
      onCounts?.(r.counts);
    } catch (e) {
      setError(e.message);
    }
  }, [filter, onCounts]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section>
      <p className="adm-intro">
        Mistakes reported by visitors with the correct words. <b>Approve</b> to use the correction
        at once everywhere — the same question, translation or word gets the corrected answer, the
        wrong Tulu is replaced wherever it appears, and the phrase joins the dictionary. Approved
        corrections are also saved to <code>training/data/corrections.tsv</code> for the next model
        training run.
      </p>
      <div className="adm-filters" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id || "all"}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`adm-filter ${filter === f.id ? "is-on" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            {f.id && counts[f.id] !== undefined && <span className="adm-count">{counts[f.id]}</span>}
          </button>
        ))}
        <button type="button" className="btn btn--quiet" onClick={load}>
          <RotateCcw size={14} /> Refresh
        </button>
      </div>
      {error && <p className="vu__err">{error}</p>}
      {items === null && !error && <p className="hint">Loading…</p>}
      {items?.length === 0 && <p className="adm-empty">Nothing here.</p>}
      <div className="adm-reports">
        {items?.map((r) => (
          <Report key={`${r.id}:${r.status}`} r={r} onDone={load} />
        ))}
      </div>
    </section>
  );
}
