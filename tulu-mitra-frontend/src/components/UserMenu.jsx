import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloudCheck, LogIn, LogOut, Trash2, UserRound } from "lucide-react";
import useAuth from "../hooks/useAuth";
import { deleteAccount, signOut } from "../services/sync";
import { setAuth } from "../services/auth";
import { useToast } from "./Toast";

function Avatar({ user, size = 30 }) {
  const [broken, setBroken] = useState(false);
  const initial = (user?.given_name || user?.name || "?").trim().charAt(0).toUpperCase();
  if (user?.picture && !broken)
    return (
      <img
        className="um__avatar"
        src={user.picture}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  return (
    <span className="um__avatar um__avatar--initial" style={{ width: size, height: size }} aria-hidden="true">
      {initial}
    </span>
  );
}

/** Navbar account button: who is signed in, sign out, delete account — or "Sign in" for guests. */
export default function UserMenu() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const notify = useToast();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (auth?.mode !== "google")
    return (
      <button
        type="button"
        className="um__signin"
        onClick={() => {
          setAuth(null);
          navigate("/login");
        }}
        title="Sign in"
      >
        <LogIn size={16} />
        <span className="um__signin-label">Sign in</span>
      </button>
    );

  const user = auth.user || {};

  const out = async () => {
    setBusy(true);
    await signOut();
    navigate("/login");
  };

  const remove = async () => {
    if (!window.confirm("Delete your Tulu Mitra account? Your saved chats and progress will be removed from the server and this browser. This can't be undone."))
      return;
    setBusy(true);
    try {
      await deleteAccount();
      notify("Your account and saved data were deleted.", "info");
      navigate("/login");
    } catch {
      setBusy(false);
      notify("Couldn't delete the account. Please try again.");
    }
  };

  return (
    <div className="um" ref={ref}>
      <button
        type="button"
        className={`um__trigger ${open ? "is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account: ${user.name || user.email}`}
        title={user.email}
      >
        <Avatar user={user} />
      </button>
      {open && (
        <div className="um__panel" role="menu">
          <div className="um__who">
            <Avatar user={user} size={40} />
            <div>
              <b>{user.name || "Signed in"}</b>
              <span>{user.email}</span>
            </div>
          </div>
          <p className="um__sync">
            <CloudCheck size={14} /> Chats and progress are saved to your account.
          </p>
          <button type="button" className="um__item" role="menuitem" onClick={out} disabled={busy}>
            <LogOut size={15} /> Sign out
          </button>
          <button type="button" className="um__item um__item--danger" role="menuitem" onClick={remove} disabled={busy}>
            <Trash2 size={15} /> Delete account and data
          </button>
          {user.is_admin && (
            <button type="button" className="um__item" role="menuitem" onClick={() => { setOpen(false); navigate("/admin"); }}>
              <UserRound size={15} /> Admin page
            </button>
          )}
        </div>
      )}
    </div>
  );
}
