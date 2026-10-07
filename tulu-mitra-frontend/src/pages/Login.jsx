import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import Mandala from "../components/Mandala";
import GoogleButton from "../components/GoogleButton";
import ThemeToggle from "../components/ThemeToggle";
import { authApi, isMockMode } from "../services/api";
import { GOOGLE_CLIENT_ID, setAuth } from "../services/auth";
import { pullAndMerge } from "../services/sync";

/**
 * The sign-in page, shown before the site the first time.
 *   Continue with Google       → chats, name and progress saved to the account
 *   Continue without signing in → everything stays in this browser only
 */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const next = location.state?.from && location.state.from !== "/login" ? location.state.from : "/";
  const [serverReady, setServerReady] = useState(null); // does the backend have GOOGLE_CLIENT_ID?
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isMockMode || !GOOGLE_CLIENT_ID) return;
    authApi
      .config()
      .then((c) => setServerReady(!!c.google))
      .catch(() => setServerReady(false));
  }, []);

  const onCredential = useCallback(
    async (credential) => {
      setBusy(true);
      setError("");
      try {
        const r = await authApi.google(credential);
        setAuth({ mode: "google", token: r.token, user: r.user });
        await pullAndMerge(r.user);
        navigate(next, { replace: true });
      } catch (e) {
        setAuth(null);
        setError(e?.message || "Sign-in didn't work. Please try again.");
        setBusy(false);
      }
    },
    [navigate, next]
  );

  const guest = () => {
    setAuth({ mode: "guest" });
    navigate(next, { replace: true });
  };

  const googleNote = isMockMode
    ? "Google sign-in needs the backend. Connect it (VITE_API_URL) to save chats to an account."
    : !GOOGLE_CLIENT_ID
      ? "Google sign-in isn't set up yet: add VITE_GOOGLE_CLIENT_ID to the frontend's .env."
      : serverReady === false
        ? "Google sign-in isn't set up on the server yet: add GOOGLE_CLIENT_ID to the backend's .env and restart it."
        : null;
  const canGoogle = !googleNote && serverReady;

  return (
    <div className="login">
      <div className="login__theme">
        <ThemeToggle />
      </div>
      <main className="login__card">
        <div className="login__mark" aria-hidden="true">
          <Mandala size={120} />
        </div>
        <h1 className="kn-display login__title">ತುಳು ಮಿತ್ರ</h1>
        <p className="login__tag">Your AI companion for Tulu</p>
        <p className="login__lead">
          Sign in to keep your chats, your name and your learning progress on every device.
        </p>

        <div className="login__actions">
          {busy ? (
            <p className="login__busy" role="status">
              <Loader2 size={16} className="spin" /> Signing you in…
            </p>
          ) : canGoogle ? (
            <GoogleButton onCredential={onCredential} onError={setError} />
          ) : (
            googleNote && <p className="login__note">{googleNote}</p>
          )}
          {!canGoogle && !googleNote && serverReady === null && (
            <p className="login__busy">
              <Loader2 size={16} className="spin" /> Checking sign-in…
            </p>
          )}
          {error && <p className="vu__err" role="alert">{error}</p>}

          <div className="login__or">
            <span>or</span>
          </div>
          <button type="button" className="btn btn--ghost login__guest" onClick={guest} disabled={busy}>
            Continue without signing in <ArrowRight size={16} />
          </button>
          <p className="login__small">Without an account, chats are kept in this browser only.</p>
        </div>

        <p className="login__privacy">
          <ShieldCheck size={14} />
          <span>
            Google checks your password — Tulu Mitra never sees it. We keep your name, e-mail, profile
            picture, chats and learning progress on the Tulu Mitra server so they follow you. You can
            delete them any time from your account menu.
          </span>
        </p>
      </main>
    </div>
  );
}
