import { useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import useDataset from "./useDataset";
import { Cell, JsonEditor, Loading, SaveBar } from "./Shared";

const PAGE = 40;
const list = (v) => (Array.isArray(v) ? v.join("; ") : v ?? "");
const split = (v) =>
  String(v || "")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);

/** The dictionary / translation word list (data/tulu_lexicon.json). */
export default function WordsPanel() {
  const ds = useDataset("lexicon");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const entries = ds.data?.entries ?? [];
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const rows = entries.map((e, i) => ({ e, i }));
    if (!t) return rows;
    return rows.filter(({ e }) =>
      [e.tulu, e.roman, e.english, list(e.english_alts), list(e.kannada), e.category]
        .join(" ")
        .toLowerCase()
        .includes(t)
    );
  }, [entries, q]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const view = shown.slice(page * PAGE, page * PAGE + PAGE);

  const edit = (i, field, value) =>
    ds.setData((d) => ({
      ...d,
      entries: d.entries.map((e, j) => (j === i ? { ...e, [field]: value } : e)),
    }));

  const add = () => {
    ds.setData((d) => ({ ...d, entries: [{ tulu: "", roman: "", english: "", english_alts: [], kannada: [], category: "" }, ...d.entries] }));
    setQ("");
    setPage(0);
  };

  const remove = (i) => ds.setData((d) => ({ ...d, entries: d.entries.filter((_, j) => j !== i) }));

  return (
    <section>
      <p className="adm-intro">
        Every word and phrase the Dictionary, Translate page and chat know, with its meanings.
        Separate several “other English” meanings or Kannada words with a semicolon ( ; ). Empty
        rows are removed when you save.
      </p>
      <Loading ds={ds} />
      {ds.data && (
        <>
          <SaveBar ds={ds}>
            <label className="adm-search">
              <Search size={15} />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                placeholder={`Search ${entries.length} entries…`}
                aria-label="Search the word list"
              />
            </label>
            <button type="button" className="btn btn--ghost" onClick={add}>
              <Plus size={15} /> Add word
            </button>
          </SaveBar>
          {ds.error && <p className="vu__err">{ds.error}</p>}

          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Tulu</th>
                  <th>Latin letters</th>
                  <th>English</th>
                  <th>Other English ( ; )</th>
                  <th>Kannada ( ; )</th>
                  <th>Category</th>
                  <th>No.</th>
                  <th aria-label="Delete" />
                </tr>
              </thead>
              <tbody>
                {view.map(({ e, i }) => (
                  <tr key={i}>
                    <td>
                      <Cell kn value={e.tulu} onChange={(v) => edit(i, "tulu", v)} placeholder="ತುಳು" />
                    </td>
                    <td>
                      <Cell value={e.roman} onChange={(v) => edit(i, "roman", v)} />
                    </td>
                    <td>
                      <Cell value={e.english} onChange={(v) => edit(i, "english", v)} />
                    </td>
                    <td>
                      <Cell value={list(e.english_alts)} onChange={(v) => edit(i, "english_alts", split(v))} />
                    </td>
                    <td>
                      <Cell kn value={list(e.kannada)} onChange={(v) => edit(i, "kannada", split(v))} />
                    </td>
                    <td>
                      <Cell value={e.category} onChange={(v) => edit(i, "category", v)} width="110px" />
                    </td>
                    <td>
                      <Cell value={e.number ?? ""} onChange={(v) => edit(i, "number", v)} width="58px" />
                    </td>
                    <td>
                      <button type="button" className="act adm-danger" onClick={() => remove(i)} aria-label={`Delete ${e.tulu}`}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="adm-pager">
              <button type="button" className="btn btn--quiet" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span className="hint">
                Page {page + 1} of {pages} · {shown.length} entries
              </span>
              <button type="button" className="btn btn--quiet" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
                Next
              </button>
            </div>
          )}
          <JsonEditor ds={ds} />
        </>
      )}
    </section>
  );
}
