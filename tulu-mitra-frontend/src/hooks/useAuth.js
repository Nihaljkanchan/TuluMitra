import { useEffect, useState } from "react";
import { getAuth } from "../services/auth";

/** The current sign-in state, updated when it changes anywhere. */
export default function useAuth() {
  const [auth, setAuth] = useState(getAuth);
  useEffect(() => {
    const on = () => setAuth(getAuth());
    window.addEventListener("tulumitra:auth", on);
    window.addEventListener("storage", on); // signed in/out in another tab
    return () => {
      window.removeEventListener("tulumitra:auth", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return auth;
}
