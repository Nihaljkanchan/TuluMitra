import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import useDataset from "./useDataset";
import { Cell, JsonEditor, Loading, SaveBar } from "./Shared";

/** Learn page lessons (data/tulu_lessons.json). */
export default function LessonsPanel() {
  const ds = useDataset("lessons");
  const [sel, setSel] = useState(0);

  const cats = ds.data?.categories ?? [];
  const i = Math.min(sel, Math.max(0, cats.length - 1));
  const cat = cats[i];

  const setCat = (fn) =>
    ds.setData((d) => ({ ...d, categories: d.categories.map((c, j) => (j === i ? fn(c) : c)) }));
  const setField = (k, v) => setCat((c) => ({ ...c, [k]: v }));
  const setItem = (n, k, v) =>
    setCat((c) => ({ ...c, items: c.items.map((it, j) => (j === n ? { ...it, [k]: v } : it)) }));
  const move = (n, by) =>
    setCat((c) => {
      const items = [...c.items];
      const [x] = items.splice(n, 1);
      items.splice(Math.max(0, Math.min(items.length, n + by)), 0, x);
      return { ...c, items };
    });

  const addCategory = () => {
    ds.setData((d) => ({
      ...d,
      categories: [...d.categories, { id: `new_${d.categories.length + 1}`, label: "New lesson", kn: "", blurb: "", items: [] }],
    }));
    setSel(cats.length);
  };

  const removeCategory = () => {
    if (!window.confirm(`Delete the whole “${cat.label}” lesson?`)) return;
    ds.setData((d) => ({ ...d, categories: d.categories.filter((_, j) => j !== i) }));
    setSel(0);
  };

  return (
    <section>
      <p className="adm-intro">
        The lessons on the Learn page (and the chat's lessons and quizzes). Changes appear on the
        Learn page as soon as you save.
      </p>
      <Loading ds={ds} />
      {ds.data && (
        <>
          <SaveBar ds={ds}>
            <select className="adm-select" value={i} onChange={(e) => setSel(Number(e.target.value))} aria-label="Lesson">
              {cats.map((c, j) => (
                <option key={j} value={j}>
                  {c.label} ({c.items.length})
                </option>
              ))}
            </select>
            <button type="button" className="btn btn--ghost" onClick={addCategory}>
              <Plus size={15} /> New lesson
            </button>
          </SaveBar>
          {ds.error && <p className="vu__err">{ds.error}</p>}

          {cat && (
            <>
              <div className="adm-fields">
                <label>
                  <span>Name</span>
                  <Cell value={cat.label} onChange={(v) => setField("label", v)} />
                </label>
                <label>
                  <span>ID (used in links)</span>
                  <Cell value={cat.id} onChange={(v) => setField("id", v)} />
                </label>
                <label>
                  <span>Title in Kannada script</span>
                  <Cell kn value={cat.kn} onChange={(v) => setField("kn", v)} />
                </label>
                <label className="adm-fields__wide">
                  <span>Short description</span>
                  <Cell value={cat.blurb} onChange={(v) => setField("blurb", v)} />
                </label>
              </div>

              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tulu</th>
                      <th>Latin letters</th>
                      <th>English</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {cat.items.map((it, n) => (
                      <tr key={n}>
                        <td className="hint">{n + 1}</td>
                        <td>
                          <Cell kn value={it.tulu} onChange={(v) => setItem(n, "tulu", v)} />
                        </td>
                        <td>
                          <Cell value={it.roman} onChange={(v) => setItem(n, "roman", v)} />
                        </td>
                        <td>
                          <Cell value={it.english} onChange={(v) => setItem(n, "english", v)} />
                        </td>
                        <td className="adm-row-acts">
                          <button type="button" className="act" onClick={() => move(n, -1)} disabled={n === 0} aria-label="Move up">
                            <ArrowUp size={14} />
                          </button>
                          <button type="button" className="act" onClick={() => move(n, 1)} disabled={n === cat.items.length - 1} aria-label="Move down">
                            <ArrowDown size={14} />
                          </button>
                          <button
                            type="button"
                            className="act adm-danger"
                            onClick={() => setCat((c) => ({ ...c, items: c.items.filter((_, j) => j !== n) }))}
                            aria-label="Delete phrase"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="adm-row">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setCat((c) => ({ ...c, items: [...c.items, { tulu: "", roman: "", english: "" }] }))}
                >
                  <Plus size={15} /> Add phrase
                </button>
                <button type="button" className="btn btn--quiet adm-danger" onClick={removeCategory}>
                  <Trash2 size={14} /> Delete this lesson
                </button>
              </div>
            </>
          )}
          <JsonEditor ds={ds} />
        </>
      )}
    </section>
  );
}
