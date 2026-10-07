import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Flag, Loader2, X } from "lucide-react";
import { isMockMode, sendFeedback } from "../services/api";
import { getProfile } from "../services/profile";

const KANNADA = /[ಀ-೿]/;

/**
 * "Report a mistake": a visitor points out wrong Tulu (or a wrong meaning)
 * and types the correct words. The report goes to the Admin page; once an
 * admin approves it, the backend uses the corrected words everywhere.
 *
 * kind   chat | translation | dictionary | lesson | other
 * input  what the visitor asked, searched or typed (so the same question
 *        gets the corrected answer next time)
 * shown  { tulu, roman, english } — what the site showed
 */
export default function ReportMistake({
  kind,
  input = "",
  shown = {},
  direction = "",
  page = "",
  compact = false,
  label = "Report a mistake",
  title = "Report a mistake",
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState("edit"); // edit | sending | sent | error
  const [error, setError] = useState("");
  const [form, setForm] = useState({ tulu: "", roman: "", english: "", note: "" });
  const firstRef = useRef(null);

  const start = () => {
    setForm({ tulu: shown.tulu || "", roman: shown.roman || "", english: shown.english || "", note: "" });
    setPhase("edit");
    setError("");
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => firstRef.current?.focus(), 50);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const changed =
    form.tulu.trim() !== (shown.tulu || "").trim() ||
    form.english.trim() !== (shown.english || "").trim() ||
    form.roman.trim() !== (shown.roman || "").trim() ||
    form.note.trim();

  const submit = async (e) => {
    e.preventDefault();
    if (!changed) {
      setError("Change the Tulu or the English to the correct words, or add a note.");
      return;
    }
    if (form.tulu.trim() && !KANNADA.test(form.tulu)) {
      setError("Please write the Tulu in Kannada script. Put the Latin-letter spelling in the box below it.");
      return;
    }
    setPhase("sending");
    setError("");
    try {
      await sendFeedback({
        kind,
        page,
        input,
        direction,
        shown,
        suggested: { tulu: form.tulu.trim(), roman: form.roman.trim(), english: form.english.trim() },
        note: form.note.trim(),
        reporter: getProfile().name || "",
      });
      setPhase("sent");
    } catch (err) {
      setPhase("error");
      setError(err?.message && err.status === 400 ? err.message : "Couldn't send the report. Please try again.");
    }
  };

  return (
    <>
      <button
        type="button"
        className={`rm__trigger ${compact ? "is-compact" : ""}`}
        onClick={start}
        title={label}
        aria-label={label}
      >
        <Flag size={compact ? 13 : 14} />
        {!compact && <span>{label}</span>}
      </button>

      {open &&
        createPortal(
          <div className="namedlg" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
            <form className="namedlg__card rm" role="dialog" aria-modal="true" aria-labelledby="rm-title" onSubmit={submit}>
              <div className="rm__head">
                <h2 id="rm-title">{title}</h2>
                <button type="button" className="btn btn--quiet" onClick={() => setOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              {phase === "sent" ? (
                <div className="rm__sent">
                  <span className="rm__ok">
                    <Check size={20} />
                  </span>
                  <p>
                    <b>ಧನ್ಯವಾದ! Thank you.</b>
                  </p>
                  <p className="hint">
                    {isMockMode
                      ? "Demo mode: your report is saved in this browser only. With the backend connected, it goes to the Admin page for review."
                      : "The Tulu Mitra team will review it. Once approved, the corrected words are used everywhere on the site."}
                  </p>
                  <button type="button" className="btn btn--primary" onClick={() => setOpen(false)}>
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {(shown.tulu || shown.english) && (
                    <div className="rm__shown">
                      <span className="rm__label">What the site showed</span>
                      {shown.tulu && <p className="kn">{shown.tulu}</p>}
                      {shown.roman && <p className="rm__muted">{shown.roman}</p>}
                      {shown.english && <p className="rm__muted">{shown.english}</p>}
                    </div>
                  )}

                  <label className="rm__field">
                    <span>Correct Tulu (Kannada script)</span>
                    <textarea ref={firstRef} className="kn" rows={2} value={form.tulu} onChange={set("tulu")} lang="tcy" />
                  </label>
                  <label className="rm__field">
                    <span>
                      Latin-letter spelling <em>optional</em>
                    </span>
                    <input value={form.roman} onChange={set("roman")} placeholder="e.g. encha ullar?" />
                  </label>
                  <label className="rm__field">
                    <span>Correct English meaning</span>
                    <input value={form.english} onChange={set("english")} />
                  </label>
                  <label className="rm__field">
                    <span>
                      What was wrong? <em>optional</em>
                    </span>
                    <input value={form.note} onChange={set("note")} placeholder="e.g. wrong word, spelling, meaning…" />
                  </label>

                  {error && <p className="vu__err">{error}</p>}

                  <div className="namedlg__actions">
                    <button type="button" className="btn btn--quiet" onClick={() => setOpen(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn--primary" disabled={phase === "sending"}>
                      {phase === "sending" ? <Loader2 size={15} className="spin" /> : <Flag size={15} />} Send report
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>,
          document.body
        )}
    </>
  );
}
