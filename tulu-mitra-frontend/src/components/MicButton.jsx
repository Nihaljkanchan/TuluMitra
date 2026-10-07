import { Mic, Square } from "lucide-react";
import VoiceOrb from "./VoiceOrb";

/**
 * The primary control of the whole product. Wrapped by the orb so the button
 * itself stays small and calm while the visualisation carries the energy.
 */
export default function MicButton({ state, onToggle, getLevel, size = 240, disabled }) {
  const recording = state === "listening";
  const busy = state === "processing" || state === "speaking" || state === "thinking";

  return (
    <div className="mic" style={{ width: size, height: size }}>
      <VoiceOrb state={state} getLevel={getLevel} size={size} />
      <button
        type="button"
        className={`mic__btn mic__btn--${state}`}
        onClick={onToggle}
        disabled={disabled || busy}
        aria-pressed={recording}
        aria-label={recording ? "Stop voice recording" : "Start voice recording"}
      >
        {recording ? <Square size={22} fill="currentColor" /> : <Mic size={26} strokeWidth={1.8} />}
      </button>
    </div>
  );
}
