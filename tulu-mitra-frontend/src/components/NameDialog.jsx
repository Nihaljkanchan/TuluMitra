import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import Mandala from "./Mandala";
import { ASK_NAME } from "../data/greetings";
import { cleanName, saveName, skipName } from "../services/profile";

/**
 * Asks the visitor's name on their very first visit (and whenever they
 * choose "change name"). The name is kept in this browser only.
 */
export default function NameDialog({ initial = "", onClose }) {
  const [name, setName] = useState(initial);
  const inputRef = useRef(null);
  const editing = Boolean(initial);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (!editing) skipName();
    onClose();
  };

  const submit = (e) => {
    e.preventDefault();
    if (!cleanName(name)) return;
    saveName(name);
    onClose();
  };

  return (
    <div className="namedlg" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <form className="namedlg__card" role="dialog" aria-modal="true" aria-labelledby="namedlg-title" onSubmit={submit}>
        <div className="namedlg__mark" aria-hidden="true">
          <Mandala size={84} />
        </div>
        <p className="namedlg__hello kn-display" lang="tcy">
          ಸೊಲ್ಮೆಲು!
        </p>
        <h2 id="namedlg-title" className="namedlg__title">
          {editing ? "What should I call you?" : "I'm Tulu Mitra. What's your name?"}
        </h2>
        <p className="namedlg__tulu">
          <span className="kn" lang="tcy">
            {ASK_NAME.tulu}
          </span>
          <span className="namedlg__roman">
            {ASK_NAME.roman} — {ASK_NAME.english}
          </span>
        </p>

        <label className="sr-only" htmlFor="namedlg-input">
          Your name
        </label>
        <input
          id="namedlg-input"
          ref={inputRef}
          className="namedlg__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={30}
          autoComplete="given-name"
        />

        <div className="namedlg__actions">
          <button type="button" className="btn btn--quiet" onClick={close}>
            {editing ? "Cancel" : "Skip for now"}
          </button>
          <button type="submit" className="btn btn--primary" disabled={!cleanName(name)}>
            {editing ? "Save" : "Continue"} <ArrowRight size={16} />
          </button>
        </div>
        <p className="namedlg__note">Saved only in this browser, so I can greet you next time.</p>
      </form>
    </div>
  );
}
