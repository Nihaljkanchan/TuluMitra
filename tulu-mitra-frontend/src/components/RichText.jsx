import { Fragment } from "react";

/**
 * Tiny inline formatter for assistant text: **bold**, *italic* and line
 * breaks. Runs of Kannada script are wrapped so they always render in
 * Noto Sans Kannada, even inside an English sentence.
 */
const KANNADA_RUN = /([ಀ-೿][ಀ-೿‌‍\s?!.,]*[ಀ-೿?!]|[ಀ-೿])/g;

function withScript(text, keyBase) {
  return text.split(KANNADA_RUN).map((part, i) =>
    i % 2 === 1 ? (
      <span key={`${keyBase}-${i}`} className="kn-run">
        {part}
      </span>
    ) : (
      <Fragment key={`${keyBase}-${i}`}>{part}</Fragment>
    )
  );
}

function inline(line, keyBase) {
  return line.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((seg, i) => {
    const key = `${keyBase}-${i}`;
    if (seg.startsWith("**") && seg.endsWith("**")) return <strong key={key}>{withScript(seg.slice(2, -2), key)}</strong>;
    if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2) return <em key={key}>{withScript(seg.slice(1, -1), key)}</em>;
    return <Fragment key={key}>{withScript(seg, key)}</Fragment>;
  });
}

export default function RichText({ text, as: Tag = "p", className = "" }) {
  const paragraphs = String(text ?? "").split(/\n{2,}/);
  return paragraphs.map((p, i) => (
    <Tag key={i} className={className}>
      {p.split("\n").map((line, j) => (
        <Fragment key={j}>
          {j > 0 && <br />}
          {inline(line, `${i}-${j}`)}
        </Fragment>
      ))}
    </Tag>
  ));
}

/* Plain-text version, for copying to the clipboard. */
export const plain = (text) => String(text ?? "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
