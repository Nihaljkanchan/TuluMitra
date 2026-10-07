const COPY = {
  listening: "Listening",
  processing: "Processing speech",
  thinking: "Tulu Mitra is thinking",
  speaking: "Speaking",
};

/** Live status line under the microphone. Announced to screen readers. */
export default function StatusIndicator({ state }) {
  const label = COPY[state];
  return (
    <p className={`status ${label ? "is-on" : ""}`} role="status" aria-live="polite">
      {label && (
        <>
          <span className={`status__dot status__dot--${state}`} />
          {label}
          <span className="status__ellipsis">
            <i />
            <i />
            <i />
          </span>
        </>
      )}
    </p>
  );
}
