import { useEffect, useRef, useState } from "react";
import { Check, Copy, Pencil, RotateCcw } from "lucide-react";
import AudioButton from "./AudioButton";
import RichText, { plain } from "./RichText";
import MessageBlocks from "./MessageBlocks";
import { languageOf } from "./LanguagePicker";
import ReportMistake from "./ReportMistake";

/* Plain-text copy of a whole reply, blocks included. */
function toPlain(m) {
  const out = [plain(m.text)];
  if (m.roman) out.push(m.roman);
  if (m.english) out.push(`English: ${m.english}`);
  for (const b of m.blocks || []) {
    if (b.type === "text" || b.type === "note") out.push(plain(b.text));
    if (b.type === "bullets") out.push(...b.items.map((t) => `• ${plain(t)}`));
    if (b.type === "phrases") out.push(...b.items.map((i) => `${i.tulu} (${i.roman}) — ${i.english ?? ""}`));
    if (b.type === "word") out.push(`${b.word} (${b.roman}) — ${b.english}`, ...(b.examples || []));
    if (b.type === "story") out.push(b.parts.map((p) => (typeof p === "string" ? p : `${p.tulu} (${p.english})`)).join(""));
    if (b.type === "lipi") out.push(b.letters.map((l) => `${l.lipi ?? "—"} ${l.roman} ${l.kannada}`).join("\n"));
    if (b.type === "letters") out.push(b.letters.map((l) => `${l.letter} ${l.roman}`).join("  "));
  }
  return out.filter(Boolean).join("\n\n");
}

/* Types the reply's opening line out, the way a live assistant does. */
function useTypewriter(text, active, onDone) {
  const full = plain(text);
  const [n, setN] = useState(active ? 0 : full.length);
  const doneRef = useRef(!active);

  useEffect(() => {
    if (!active) return undefined;
    const step = Math.max(1, Math.ceil(full.length / 42));
    const id = setInterval(() => {
      setN((v) => {
        const next = Math.min(full.length, v + step);
        if (next >= full.length) clearInterval(id);
        return next;
      });
    }, 18);
    return () => clearInterval(id);
  }, [active, full.length]);

  const done = n >= full.length;
  useEffect(() => {
    if (done && !doneRef.current) {
      doneRef.current = true;
      onDone?.();
    }
  }, [done, onDone]);

  return { done, partial: full.slice(0, n), finish: () => setN(full.length) };
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="act"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard blocked */
        }
      }}
      aria-label="Copy"
      title="Copy"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

/**
 * One turn of the conversation. Assistant turns show up to three layers —
 * the reply, its Latin-letter reading and its English meaning — then any
 * structured content (phrase lists, word cards, letters), then follow-up
 * suggestions.
 */
export default function ChatMessage({
  message,
  question,
  audio,
  isLast,
  busy,
  skipTyping,
  onTyped,
  onRegenerate,
  onEdit,
  onSuggest,
}) {
  const isUser = message.role === "user";
  const tw = useTypewriter(message.text || "", !isUser && !!message.fresh, onTyped);

  useEffect(() => {
    if (skipTyping) tw.finish();
  }, [skipTyping]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isUser) {
    const lang = languageOf(message.language);
    return (
      <article className="msg msg--user">
        <div className="msg__bubble">
          <p className={`msg__text ${lang.script === "kn" || /[ಀ-೿]/.test(message.text) ? "kn" : ""}`}>
            {message.text}
          </p>
        </div>
        <div className="msg__foot">
          <span className="msg__meta">
            {message.viaVoice ? "Spoken" : "Typed"} in {lang.name}
          </span>
          <span className="msg__acts">
            <CopyButton text={message.text} />
            {onEdit && (
              <button type="button" className="act" onClick={() => onEdit(message)} aria-label="Edit and resend" title="Edit">
                <Pencil size={13} />
              </button>
            )}
          </span>
        </div>
      </article>
    );
  }

  const tulu = message.lang !== "english";
  const playKey = message.id;

  return (
    <article className={`msg msg--bot ${message.error ? "is-error" : ""}`}>
      <span className="bot-av kn-display" aria-hidden="true">ತು</span>
      <div className="msg__col">
        <span className="kn-display msg__who">ತುಳು ಮಿತ್ರ</span>

        <div className="msg__bubble">
          {tw.done ? (
            <RichText text={message.text} className={`msg__text ${tulu ? "kn msg__text--tulu" : ""}`} />
          ) : (
            <p className={`msg__text ${tulu ? "kn msg__text--tulu" : ""}`}>
              {tw.partial}
              <span className="caret" aria-hidden="true" />
            </p>
          )}

          {tw.done && (
            <div className="msg__rest">
              {message.roman && <p className="msg__roman">{message.roman}</p>}

              {tulu && message.english && (
                <div className="msg__meaning">
                  <span className="msg__meaning-label">English</span>
                  <p>{message.english}</p>
                </div>
              )}

              {tulu && message.text && (
                <AudioButton
                  onClick={() => audio.play(playKey, message.text, message.audioUrl)}
                  playing={audio.playingKey === playKey}
                  loading={audio.loadingKey === playKey}
                />
              )}

              {message.blocks?.length > 0 && (
                <div className="msg__blocks">
                  <MessageBlocks blocks={message.blocks} id={message.id} audio={audio} link={message.link} />
                </div>
              )}
              {!message.blocks?.length && message.link && (
                <MessageBlocks blocks={[]} id={message.id} audio={audio} link={message.link} />
              )}
            </div>
          )}
        </div>

        {tw.done && (
          <div className="msg__foot msg__foot--bot">
            <span className="msg__acts">
              <CopyButton text={toPlain(message)} />
              {!message.error && (
                <ReportMistake
                  compact
                  kind="chat"
                  page="home"
                  input={question || ""}
                  shown={
                    message.lang === "english"
                      ? { english: plain(message.text) }
                      : { tulu: message.text, roman: message.roman || "", english: message.english || "" }
                  }
                />
              )}
              {isLast && onRegenerate && (
                <button type="button" className="act" onClick={onRegenerate} disabled={busy} aria-label="Regenerate reply" title="Regenerate">
                  <RotateCcw size={14} />
                </button>
              )}
            </span>
            {message.topic && <span className="msg__topic">{message.topic}</span>}
          </div>
        )}

        {tw.done && isLast && message.suggestions?.length > 0 && (
          <div className="followups" role="group" aria-label="Suggested replies">
            {message.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip chip--follow ${/[ಀ-೿]/.test(s) ? "kn" : ""}`}
                onClick={() => onSuggest(s)}
                disabled={busy}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
