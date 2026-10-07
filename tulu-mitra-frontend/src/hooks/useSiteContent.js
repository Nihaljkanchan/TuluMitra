import { useEffect, useState } from "react";
import { siteContent } from "../services/api";

/**
 * Lessons and greetings as edited on the Admin page (GET /content).
 * null in demo mode or until loaded — callers then use the built-in data.
 */
export default function useSiteContent() {
  const [content, setContent] = useState(null);
  useEffect(() => {
    let alive = true;
    siteContent().then((c) => alive && setContent(c));
    return () => {
      alive = false;
    };
  }, []);
  return content;
}
