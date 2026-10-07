import { Loader2, Volume2, Square } from "lucide-react";

/**
 * Shared play control for every Tulu utterance in the app — chat replies,
 * translations, lessons, numbers and letters all use this so the audio
 * language is identical everywhere.
 */
export default function AudioButton({ onClick, playing, loading, label = "Play", compact }) {
  const text = loading ? "Generating audio" : playing ? "Speaking" : label;
  return (
    <button
      type="button"
      className={`audio-btn ${playing ? "is-playing" : ""} ${compact ? "is-compact" : ""}`}
      onClick={onClick}
      aria-label={playing ? "Stop audio" : "Play Tulu audio"}
    >
      {loading ? (
        <Loader2 size={15} className="spin" />
      ) : playing ? (
        <Square size={13} fill="currentColor" />
      ) : (
        <Volume2 size={15} />
      )}
      <span>{text}</span>
      {playing && !compact && (
        <span className="eq" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
    </button>
  );
}
