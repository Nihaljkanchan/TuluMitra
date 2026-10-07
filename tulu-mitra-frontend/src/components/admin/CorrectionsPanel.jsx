import { Download, Trash2 } from "lucide-react";
import { adminApi } from "../../services/api";
import { useToast } from "../Toast";
import useDataset from "./useDataset";
import { Cell, JsonEditor, Loading, SaveBar } from "./Shared";

/** Approved corrections (data/corrections.json) — edit, remove or export. */
export default function CorrectionsPanel() {
  const ds = useDataset("corrections");
  const notify = useToast();
  const items = ds.data?.items ?? [];

  const edit = (n, k, v) => ds.setData((d) => ({ ...d, items: d.items.map((c, j) => (j === n ? { ...c, [k]: v } : c)) }));

  const exportTsv = async () => {
    try {
      const blob = await adminApi.exportCorrections();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "tulu-mitra-corrections.tsv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      notify(e.message || "Export failed");
    }
  };

  return (
    <section>
      <p className="adm-intro">
        Every approved correction, in use now. The backend answers these questions with the
        corrected words, replaces the wrong Tulu wherever it appears, and adds them to the
        dictionary. <b>Download for training</b> gives the same list as a spreadsheet file (TSV) to
        add to your training data.
      </p>
      <Loading ds={ds} />
      {ds.data && (
        <>
          <SaveBar ds={ds}>
            <button type="button" className="btn btn--ghost" onClick={exportTsv}>
              <Download size={15} /> Download for training
            </button>
          </SaveBar>
          {ds.error && <p className="vu__err">{ds.error}</p>}
          {items.length === 0 && <p className="adm-empty">No approved corrections yet.</p>}
          {items.length > 0 && (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Question / text</th>
                    <th>Was</th>
                    <th>Correct Tulu</th>
                    <th>Latin letters</th>
                    <th>English</th>
                    <th aria-label="Delete" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((c, n) => (
                    <tr key={c.id ?? n}>
                      <td className="hint">{c.kind}</td>
                      <td>
                        <Cell value={c.input} onChange={(v) => edit(n, "input", v)} />
                      </td>
                      <td className="kn adm-was">{c.wrong?.tulu || c.wrong?.english || "—"}</td>
                      <td>
                        <Cell kn value={c.tulu} onChange={(v) => edit(n, "tulu", v)} />
                      </td>
                      <td>
                        <Cell value={c.roman} onChange={(v) => edit(n, "roman", v)} />
                      </td>
                      <td>
                        <Cell value={c.english} onChange={(v) => edit(n, "english", v)} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="act adm-danger"
                          onClick={() => ds.setData((d) => ({ ...d, items: d.items.filter((_, j) => j !== n) }))}
                          aria-label="Remove correction"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <JsonEditor ds={ds} />
        </>
      )}
    </section>
  );
}
