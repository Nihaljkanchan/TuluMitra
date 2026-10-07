export default function ProgressRing({ value, total, size = 76 }) {
  const pct = total ? value / total : 0;
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring" role="img"
      aria-label={`${value} of ${total} items listened`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hairline)" strokeWidth="5" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--green)" strokeWidth="5"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset .6s var(--ease)" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fontSize="15" fontWeight="600" fill="var(--ink)">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}
