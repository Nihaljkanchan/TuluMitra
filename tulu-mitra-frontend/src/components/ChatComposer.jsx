import { useEffect, useRef } from "react";
import { ArrowUp, Mic, Square } from "lucide-react";

/**
 * Bottom composer: mic and send sit inside one contained field so voice and
 * text read as two doors into the same conversation. While a reply is being
 * written the send button becomes a stop button.
 */
export default function ChatComposer({
  value,
  onChange,
  onSend,
  onMic,
  onStop,
  state,
  generating,
  disabled,
  inputRef,
  language = { name: "Tulu", script: "kn" },
}) {
  const ownRef = useRef(null);
  const taRef = inputRef ?? ownRef;
  const recording = state === "listening";
  const busy = state === "processing" || state === "thinking";
  const canSend = value.trim().length > 0 && !busy && !generating;

  const grow = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  /* Keep the height right when text is set from outside (edit, suggestion). */
  useEffect(() => {
    grow(taRef.current);
  }, [value, taRef]);

  const submit = () => {
    if (!canSend) return;
    onSend(value.trim());
  };

  return (
    <div className="composer">
      <div className={`composer__field ${recording ? "is-recording" : ""}`}>
        <button
          type="button"
          className={`composer__mic ${recording ? "is-recording" : ""}`}
          onClick={onMic}
          disabled={disabled || busy || generating}
          aria-label={recording ? "Stop voice recording" : "Start voice recording"}
          title={recording ? "Stop recording" : "Speak"}
        >
          {recording ? <Square size={15} fill="currentColor" /> : <Mic size={18} strokeWidth={1.8} />}
        </button>

        <textarea
          ref={taRef}
          className={`composer__input ${language.script === "kn" ? "kn" : ""}`}
          rows={1}
          value={value}
          placeholder={recording ? "Listening…" : `Message Tulu Mitra in ${language.name}…`}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={recording}
          aria-label="Message Tulu Mitra"
        />

        {busy || generating ? (
          <button type="button" className="composer__send composer__send--stop" onClick={onStop} aria-label="Stop generating" title="Stop">
            <Square size={13} fill="currentColor" />
          </button>
        ) : (
          <button type="button" className="composer__send" onClick={submit} disabled={!canSend} aria-label="Send message">
            <ArrowUp size={18} strokeWidth={2.2} />
          </button>
        )}
      </div>
      <p className="composer__note">
        Enter to send · Shift + Enter for a new line · Replies come in Tulu with the English meaning
      </p>
    </div>
  );
}
