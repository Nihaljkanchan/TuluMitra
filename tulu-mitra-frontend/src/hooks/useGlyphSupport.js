import { useEffect, useState } from "react";

/**
 * Reports whether this device can actually draw a script.
 *
 * Tulu Lipi (Tulu-Tigalari) is in Unicode but no mainstream operating system
 * ships a font for it, so without one every letter renders as an empty box.
 * Rather than let that happen silently in front of an audience, the Learn
 * page asks this hook first and explains the situation instead.
 *
 * HOW THE TEST WORKS. When a font is missing, the browser draws its own
 * "missing glyph" placeholder. Earlier this hook assumed that placeholder is
 * always exactly one em wide — true on some browsers, but not guaranteed on
 * every browser/OS, which let real devices slip through as "supported" and
 * show raw tofu boxes instead of the Kannada fallback.
 *
 * The fix is to stop assuming a size and instead measure a codepoint that is
 * GUARANTEED missing everywhere: `missingRef` (passed in by the caller) —
 * for Tulu Lipi this is U+1138A, a slot Unicode has confirmed unassigned in
 * this exact block (see src/data/tuluLipi.js). No font, on any device, can
 * draw it. Whatever width THIS browser gives that character is this
 * browser's own "missing glyph" width, measured in the same font stack — so
 * comparing the real probes against it works regardless of how any given
 * browser draws its placeholder.
 */
const SIZE = 64; // px
const TOLERANCE = 1;

export default function useGlyphSupport(probes, fontStack, missingRef) {
  const [supported, setSupported] = useState(null); // null = still checking

  useEffect(() => {
    let cancelled = false;

    const measure = () => {
      try {
        const ctx = document.createElement("canvas").getContext("2d");
        if (!ctx) return true; // can't tell — assume yes rather than warn wrongly
        ctx.font = `${SIZE}px ${fontStack}`;

        const refWidth = ctx.measureText(missingRef).width;
        const probeWidths = probes.map((c) => ctx.measureText(c).width);
        if (!probeWidths.length || probeWidths.some((w) => !w) || !refWidth) {
          return false;
        }

        /* If every probe measures the same as the guaranteed-missing
           reference character, this browser is drawing the same
           placeholder for all of them — no real font is present. */
        const allLikeMissing = probeWidths.every(
          (w) => Math.abs(w - refWidth) < TOLERANCE
        );
        return !allLikeMissing;
      } catch {
        return true;
      }
    };

    /* Wait for any webfont to finish loading (or failing) before measuring. */
    const run = () => {
      if (!cancelled) setSupported(measure());
    };

    if (document.fonts?.ready) {
      document.fonts.ready.then(run).catch(run);
    } else {
      run();
    }

    return () => {
      cancelled = true;
    };
  }, [probes, fontStack, missingRef]);

  return supported;
}
