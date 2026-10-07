import { useCallback, useEffect, useState } from "react";
import { adminApi, refreshSiteContent } from "../../services/api";
import { useToast } from "../Toast";

/**
 * Load one editable data file from the backend (word list, lessons,
 * greetings, corrections), keep local edits, and save them back.
 */
export default function useDataset(name) {
  const [data, setData] = useState(null);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const notify = useToast();

  const load = useCallback(async () => {
    setError("");
    try {
      const d = await adminApi.get(name);
      setData(d);
      setSaved(JSON.stringify(d));
    } catch (err) {
      setError(err.message || "Could not load.");
    }
  }, [name]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (next = data) => {
    setSaving(true);
    setError("");
    try {
      const r = await adminApi.save(name, next);
      setData(r.data);
      setSaved(JSON.stringify(r.data));
      refreshSiteContent();
      notify("Saved. The website uses it now.", "info");
      return true;
    } catch (err) {
      setError(err.message || "Could not save.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const dirty = data !== null && JSON.stringify(data) !== saved;
  return { data, setData, save, saving, error, setError, dirty, reload: load };
}
