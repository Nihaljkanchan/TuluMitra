import { useCallback, useEffect, useState } from "react";

const KEY = "tulu-mitra:listened";

/**
 * Which lesson items the learner has played, kept across page reloads.
 * Keys are namespaced by section ("phrases:greetings:0", "numbers:42",
 * "script:vowels:3") so one tracker covers phrases, numbers and letters.
 */
export default function useProgress() {
  const [listened, setListened] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...listened]));
    } catch {
      /* storage unavailable — progress simply stays in memory */
    }
  }, [listened]);

  const mark = useCallback((id) => setListened((s) => (s.has(id) ? s : new Set(s).add(id))), []);

  /* Clear only one section, so resetting Numbers leaves phrases alone. */
  const resetSection = useCallback((prefix) => {
    setListened((s) => new Set([...s].filter((k) => !k.startsWith(`${prefix}:`))));
  }, []);

  const countIn = useCallback(
    (prefix) => [...listened].filter((k) => k.startsWith(`${prefix}:`)).length,
    [listened]
  );

  return { listened, mark, resetSection, countIn, count: listened.size };
}
