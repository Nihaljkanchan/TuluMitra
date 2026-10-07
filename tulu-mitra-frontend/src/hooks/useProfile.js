import { useEffect, useState } from "react";
import { getProfile } from "../services/profile";

/** The visitor's profile (name, visits), updated whenever it changes. */
export default function useProfile() {
  const [profile, setProfile] = useState(getProfile);
  useEffect(() => {
    const on = (e) => setProfile(e.detail ?? getProfile());
    window.addEventListener("tulumitra:profile", on);
    return () => window.removeEventListener("tulumitra:profile", on);
  }, []);
  return profile;
}

/* Ask any page to reopen the name dialog. */
export const editName = () => window.dispatchEvent(new Event("tulumitra:edit-name"));
