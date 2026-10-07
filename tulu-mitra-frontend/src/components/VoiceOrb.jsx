import { useEffect, useRef } from "react";

/**
 * The signature element of the product: a ring of radial ticks that reacts to
 * real microphone amplitude while recording, sweeps while the backend works,
 * and settles into an even pulse while the assistant speaks.
 *
 * Drawn on canvas rather than with CSS keyframes so that the motion is driven
 * by actual audio data instead of a fixed loop.
 */
const TICKS = 84;

export default function VoiceOrb({ state = "idle", getLevel, size = 240 }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(state);
  const phaseRef = useRef(0);
  const smoothRef = useRef(new Float32Array(TICKS));
  const levelFnRef = useRef(getLevel);

  stateRef.current = state;
  levelFnRef.current = getLevel;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const draw = () => {
      const s = stateRef.current;
      const t = (phaseRef.current += reduced ? 0 : 0.016);
      const cx = size / 2;
      const cy = size / 2;
      const inner = size * 0.29;

      ctx.clearRect(0, 0, size, size);

      // Brand colours, lighter in dark mode so the ring stays visible.
      const dark = document.documentElement.dataset.theme === "dark";
      const P = dark ? "178, 171, 247" : "60, 52, 137";
      const G = dark ? "111, 208, 178" : "8, 80, 65";

      const level =
        s === "listening"
          ? Math.max(0.06, levelFnRef.current?.() ?? 0)
          : s === "speaking"
            ? 0.45
            : 0.05;

      // Ambient glow, brightest while the ring is active.
      const glow = ctx.createRadialGradient(cx, cy, inner * 0.6, cx, cy, size * 0.5);
      const alpha = s === "idle" ? 0.1 : 0.16 + level * 0.22;
      glow.addColorStop(0, `rgba(${P}, ${alpha})`);
      glow.addColorStop(1, `rgba(${P}, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // Radial ticks.
      const smooth = smoothRef.current;
      for (let i = 0; i < TICKS; i++) {
        const a = (i / TICKS) * Math.PI * 2 - Math.PI / 2;

        let target;
        if (s === "listening") {
          const wave = 0.55 + 0.45 * Math.sin(i * 0.7 + t * 5.5) * Math.sin(i * 0.23 - t * 2.1);
          target = 0.1 + level * wave * 1.5;
        } else if (s === "speaking") {
          target = 0.12 + 0.5 * Math.abs(Math.sin(i * 0.9 + t * 7)) * (0.5 + 0.5 * Math.sin(t * 3));
        } else if (s === "processing") {
          // A comet of light travelling around the ring.
          const head = (t * 0.9) % 1;
          const d = Math.min(Math.abs(i / TICKS - head), 1 - Math.abs(i / TICKS - head));
          target = 0.08 + Math.max(0, 0.5 - d * 3.4);
        } else {
          target = 0.07 + 0.03 * Math.sin(i * 0.5 + t * 1.4);
        }

        smooth[i] += (target - smooth[i]) * 0.28;
        const len = size * 0.5 * Math.min(smooth[i], 0.62);

        const r1 = inner + size * 0.045;
        const r2 = r1 + len;
        const strength = Math.min(1, smooth[i] * 3.2);

        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.strokeStyle =
          s === "speaking"
            ? `rgba(${G}, ${0.2 + strength * 0.6})`
            : `rgba(${P}, ${0.16 + strength * 0.62})`;
        ctx.stroke();
      }

      // Hairline that holds the ticks together.
      ctx.beginPath();
      ctx.arc(cx, cy, inner + size * 0.03, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${P}, 0.16)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      className="orb"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
