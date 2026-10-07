/**
 * A mandala drawn from geometry rather than an image file, so it stays sharp
 * at any size, inherits the theme colours, and adds nothing to the download.
 *
 * The rings are built the way a rangoli is: a fixed number of petals repeated
 * around a centre, with a ring of dots between each band.
 */

function petals({ count, inner, outer, width, cx, cy }) {
  const paths = [];
  for (let i = 0; i < count; i++) {
    const angle = (360 / count) * i;
    paths.push(
      <path
        key={`${inner}-${i}`}
        d={`M ${cx} ${cy - inner}
            C ${cx + width} ${cy - inner - (outer - inner) * 0.28},
              ${cx + width} ${cy - outer + (outer - inner) * 0.28},
              ${cx} ${cy - outer}
            C ${cx - width} ${cy - outer + (outer - inner) * 0.28},
              ${cx - width} ${cy - inner - (outer - inner) * 0.28},
              ${cx} ${cy - inner} Z`}
        transform={`rotate(${angle} ${cx} ${cy})`}
      />
    );
  }
  return paths;
}

function dots({ count, radius, cx, cy, r = 1.6 }) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = ((Math.PI * 2) / count) * i - Math.PI / 2;
    out.push(
      <circle
        key={`${radius}-${i}`}
        cx={cx + Math.cos(a) * radius}
        cy={cy + Math.sin(a) * radius}
        r={r}
      />
    );
  }
  return out;
}

export default function Mandala({ size = 460, className = "" }) {
  const c = 250;

  return (
    <svg
      className={`mandala ${className}`}
      width={size}
      height={size}
      viewBox="0 0 500 500"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* Outer band */}
      <g className="mandala__ink" strokeWidth="1" fill="none">
        <circle cx={c} cy={c} r="242" />
        <circle cx={c} cy={c} r="232" />
        {petals({ count: 32, inner: 196, outer: 228, width: 13, cx: c, cy: c })}
      </g>

      <g className="mandala__gold" fill="currentColor" stroke="none">
        {dots({ count: 32, radius: 186, cx: c, cy: c, r: 2 })}
      </g>

      {/* Middle band — the widest petals carry the eye */}
      <g className="mandala__gold" strokeWidth="1.2" fill="none">
        <circle cx={c} cy={c} r="176" />
        {petals({ count: 16, inner: 112, outer: 172, width: 34, cx: c, cy: c })}
      </g>

      {/* Inner band */}
      <g className="mandala__ink" strokeWidth="1" fill="none">
        <circle cx={c} cy={c} r="106" />
        <circle cx={c} cy={c} r="98" />
        {petals({ count: 12, inner: 56, outer: 94, width: 20, cx: c, cy: c })}
      </g>

      <g className="mandala__gold" fill="currentColor" stroke="none">
        {dots({ count: 12, radius: 48, cx: c, cy: c, r: 2.4 })}
      </g>

      <g className="mandala__ink" strokeWidth="1" fill="none">
        <circle cx={c} cy={c} r="38" />
      </g>
    </svg>
  );
}
