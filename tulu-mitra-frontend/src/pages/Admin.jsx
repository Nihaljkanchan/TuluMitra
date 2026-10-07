import { useState } from "react";
import { BookOpen, Flag, Gauge, Hand, KeyRound, Languages, ListChecks, Loader2, LogOut } from "lucide-react";
import { adminApi, adminPassword, isMockMode } from "../services/api";
import useAuth from "../hooks/useAuth";
import ReportsPanel from "../components/admin/ReportsPanel";
import WordsPanel from "../components/admin/WordsPanel";
import LessonsPanel from "../components/admin/LessonsPanel";
import GreetingsPanel from "../components/admin/GreetingsPanel";
import CorrectionsPanel from "../components/admin/CorrectionsPanel";
import SystemPanel from "../components/admin/SystemPanel";

const TABS = [
  { id: "reports", label: "Reports", icon: Flag },
  { id: "words", label: "Word list", icon: Languages },
  { id: "lessons", label: "Lessons", icon: BookOpen },
  { id: "greetings", label: "Greetings", icon: Hand },
  { id: "corrections", label: "Corrections", icon: ListChecks },
  { id: "system", label: "System", icon: Gauge },
];

function Login({ onIn }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await adminApi.login(pw);
      adminPassword.set(pw);
      onIn();
    } catch (x) {
      setErr(x.status === 0 ? "Can't reach the backend. Is it running?" : x.message || "Couldn't sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="adm-login" onSubmit={submit}>
      <KeyRound size={22} />
      <h2>Admin sign-in</h2>
      <p className="hint">Enter the ADMIN_PASSWORD set in the backend's .env file.</p>
      <label className="sr-only" htmlFor="adm-pw">
        Admin password
      </label>
      <input id="adm-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" autoFocus />
      {err && <p className="vu__err">{err}</p>}
      <button type="submit" className="btn btn--primary" disabled={!pw || busy}>
        {busy && <Loader2 size={15} className="spin" />} Sign in
      </button>
    </form>
  );
}

/**
 * Admin page (/admin): review mistake reports and edit the site's content.
 * Everything here reads and writes the backend's data files; the backend
 * checks the admin password on every request.
 */
export default function Admin() {
  const auth = useAuth();
  const byEmail = auth?.mode === "google" && auth.user?.is_admin; // listed in ADMIN_EMAILS
  const [pwIn, setSignedIn] = useState(() => !!adminPassword.get());
  const signedIn = pwIn || byEmail;
  const [tab, setTab] = useState("reports");
  const [pending, setPending] = useState(null);

  const signOut = () => {
    adminPassword.set("");
    setSignedIn(false);
  };

  if (isMockMode)
    return (
      <div className="page">
        <header className="page-head">
          <h1>Admin</h1>
        </header>
        <div className="adm-login">
          <KeyRound size={22} />
          <h2>The Admin page needs the backend</h2>
          <p className="hint">
            It edits the backend's data files. Set <code>VITE_API_URL</code> in the frontend's .env,
            set <code>ADMIN_PASSWORD</code> in the backend's .env, restart both, and open this page again.
          </p>
        </div>
      </div>
    );

  return (
    <div className="page page--wide">
      <header className="page-head adm-head">
        <div>
          <h1>Admin</h1>
          <p>Review reported mistakes and edit the words, lessons and greetings the site uses.</p>
        </div>
        {pwIn && (
          <button type="button" className="btn btn--quiet" onClick={signOut}>
            <LogOut size={15} /> Sign out
          </button>
        )}
      </header>

      {!signedIn ? (
        <Login onIn={() => setSignedIn(true)} />
      ) : (
        <>
          <nav className="adm-tabs" aria-label="Admin sections">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`adm-tab ${tab === id ? "is-on" : ""}`}
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
              >
                <Icon size={15} /> {label}
                {id === "reports" && pending ? <span className="adm-count">{pending}</span> : null}
              </button>
            ))}
          </nav>
          <div className="adm-body">
            {tab === "reports" && <ReportsPanel onCounts={(c) => setPending(c.pending)} />}
            {tab === "words" && <WordsPanel />}
            {tab === "lessons" && <LessonsPanel />}
            {tab === "greetings" && <GreetingsPanel />}
            {tab === "corrections" && <CorrectionsPanel />}
            {tab === "system" && <SystemPanel />}
          </div>
        </>
      )}
    </div>
  );
}
