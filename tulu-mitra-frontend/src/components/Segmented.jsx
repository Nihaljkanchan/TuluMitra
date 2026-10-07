/** Small pill selector used for language pairs, categories and number pages. */
export default function Segmented({ options, value, onChange, label, scroll }) {
  return (
    <div className={`seg ${scroll ? "seg--scroll" : ""}`} role="group" aria-label={label}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            className={`seg__item ${active ? "is-active" : ""}`}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
