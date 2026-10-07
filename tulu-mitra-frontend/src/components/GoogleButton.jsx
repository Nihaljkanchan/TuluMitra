import { useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID } from "../services/auth";

let loading = null;
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = resolve;
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load Google sign-in. Check the internet connection."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Google's own "Continue with Google" button (Google Identity Services).
 * Google handles the password; we only receive a signed ID token, which
 * the backend verifies. onCredential(token) is called after sign-in.
 */
export default function GoogleButton({ onCredential, onError, width = 300 }) {
  const ref = useRef(null);
  const cbRef = useRef(onCredential);
  const [failed, setFailed] = useState(false);
  cbRef.current = onCredential;

  useEffect(() => {
    let alive = true;
    loadGoogle()
      .then(() => {
        if (!alive || !ref.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (resp) => cbRef.current?.(resp.credential),
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        const dark = document.documentElement.dataset.theme === "dark";
        window.google.accounts.id.renderButton(ref.current, {
          type: "standard",
          theme: dark ? "filled_black" : "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "left",
          width,
        });
      })
      .catch((e) => {
        if (!alive) return;
        setFailed(true);
        onError?.(e.message);
      });
    return () => {
      alive = false;
    };
  }, [width, onError]);

  if (failed) return null;
  return <div className="gbtn" ref={ref} style={{ minHeight: 44 }} />;
}
