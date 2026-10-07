import { Plus, Trash2 } from "lucide-react";
import useDataset from "./useDataset";
import { Cell, JsonEditor, Loading, SaveBar } from "./Shared";

const TIMES = ["morning", "afternoon", "evening", "night"];

/** Welcome-screen greetings on Home (data/site_content.json). */
export default function GreetingsPanel() {
  const ds = useDataset("greetings");
  const g = ds.data;

  const set = (k, v) => ds.setData((d) => ({ ...d, [k]: v }));
  const setQ = (n, k, v) => set("questions", g.questions.map((q, j) => (j === n ? { ...q, [k]: v } : q)));
  const setT = (n, k, v) => set("time_of_day", g.time_of_day.map((t, j) => (j === n ? { ...t, [k]: v } : t)));
  const toggleWhen = (n, time) => {
    const when = g.questions[n].when || [];
    setQ(n, "when", when.includes(time) ? when.filter((w) => w !== time) : [...when, time]);
  };

  return (
    <section>
      <p className="adm-intro">
        The greeting on the Home screen. The headline is followed by the visitor's name; one
        question is picked for each visit from the ones that fit the time of day and whether it is
        their first visit. In the lines below, <code>{"{name}"}</code> becomes the visitor's name.
      </p>
      <Loading ds={ds} />
      {g && (
        <>
          <SaveBar ds={ds} />
          {ds.error && <p className="vu__err">{ds.error}</p>}

          <h3 className="adm-h3">Headline</h3>
          <div className="adm-fields">
            <label>
              <span>Tulu</span>
              <Cell kn value={g.headline?.tulu} onChange={(v) => set("headline", { ...g.headline, tulu: v })} />
            </label>
            <label>
              <span>Latin letters</span>
              <Cell value={g.headline?.roman} onChange={(v) => set("headline", { ...g.headline, roman: v })} />
            </label>
            <label>
              <span>English</span>
              <Cell value={g.headline?.english} onChange={(v) => set("headline", { ...g.headline, english: v })} />
            </label>
          </div>

          <h3 className="adm-h3">Questions</h3>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Tulu</th>
                  <th>Latin letters</th>
                  <th>English</th>
                  <th>Only at (none ticked = any time)</th>
                  <th>Visit</th>
                  <th aria-label="Delete" />
                </tr>
              </thead>
              <tbody>
                {g.questions.map((q, n) => (
                  <tr key={n}>
                    <td>
                      <Cell kn value={q.tulu} onChange={(v) => setQ(n, "tulu", v)} />
                    </td>
                    <td>
                      <Cell value={q.roman} onChange={(v) => setQ(n, "roman", v)} />
                    </td>
                    <td>
                      <Cell value={q.english} onChange={(v) => setQ(n, "english", v)} />
                    </td>
                    <td className="adm-checks">
                      {TIMES.map((t) => (
                        <label key={t}>
                          <input type="checkbox" checked={(q.when || []).includes(t)} onChange={() => toggleWhen(n, t)} /> {t}
                        </label>
                      ))}
                    </td>
                    <td>
                      <select className="adm-select" value={q.visit || ""} onChange={(e) => setQ(n, "visit", e.target.value)}>
                        <option value="">Any visit</option>
                        <option value="first">First visit</option>
                        <option value="returning">Returning</option>
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="act adm-danger"
                        onClick={() => set("questions", g.questions.filter((_, j) => j !== n))}
                        aria-label="Delete question"
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
              onClick={() => set("questions", [...g.questions, { tulu: "", roman: "", english: "", when: [], visit: "" }])}
            >
              <Plus size={15} /> Add question
            </button>
          </div>

          <h3 className="adm-h3">Lines beside the time of day</h3>
          <div className="adm-fields">
            {[
              ["first", "First visit"],
              ["returning", "Returning"],
              ["long_away", "Back after a long time"],
            ].map(([k, label]) => (
              <label key={k}>
                <span>{label}</span>
                <Cell value={g.visit_lines?.[k]} onChange={(v) => set("visit_lines", { ...g.visit_lines, [k]: v })} />
              </label>
            ))}
            <label>
              <span>“Long time” means at least … days</span>
              <Cell type="number" value={g.long_away_days} onChange={(v) => set("long_away_days", v)} width="90px" />
            </label>
          </div>

          <h3 className="adm-h3">Times of day (24-hour clock; night runs past midnight, e.g. 21 to 29 = 9 pm to 5 am)</h3>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>From hour</th>
                  <th>To hour</th>
                  <th>Shown as</th>
                </tr>
              </thead>
              <tbody>
                {g.time_of_day.map((t, n) => (
                  <tr key={n}>
                    <td className="hint">{t.key}</td>
                    <td>
                      <Cell type="number" value={t.from} onChange={(v) => setT(n, "from", v)} width="80px" />
                    </td>
                    <td>
                      <Cell type="number" value={t.to} onChange={(v) => setT(n, "to", v)} width="80px" />
                    </td>
                    <td>
                      <Cell value={t.english} onChange={(v) => setT(n, "english", v)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <JsonEditor ds={ds} />
        </>
      )}
    </section>
  );
}
