import { useNavigate } from "react-router-dom";
import { ArrowRight, Info, Loader2, Square, Volume2 } from "lucide-react";
import RichText from "./RichText";
import useGlyphSupport from "../hooks/useGlyphSupport";
import { LIPI_MISSING_REF, LIPI_PROBES } from "../data/tuluLipi";

/* A small round play control used inside answer blocks. */
function Speak({ id, text, audio, label = "Play" }) {
  const playing = audio.playingKey === id;
  const loading = audio.loadingKey === id;
  return (
    <button
      type="button"
      className={`speak ${playing ? "is-playing" : ""}`}
      onClick={() => audio.play(id, text)}
      aria-label={playing ? "Stop audio" : `${label}: ${text}`}
      title={playing ? "Stop" : "Play"}
    >
      {loading ? <Loader2 size={13} className="spin" /> : playing ? <Square size={10} fill="currentColor" /> : <Volume2 size={14} />}
    </button>
  );
}

function PhraseList({ block, id, audio }) {
  return (
    <div className="blk blk--phrases">
      {block.title && <h4 className="blk__title">{block.title}</h4>}
      <ul className={`phr ${block.numbered ? "phr--numbered" : ""}`}>
        {block.items.map((it, i) => (
          <li key={i} className="phr__row">
            {block.numbered && <span className="phr__num">{it.english}</span>}
            <div className="phr__body">
              <span className="kn phr__tulu">{it.tulu}</span>
              <span className="phr__roman">
                {it.roman}
                {it.note && <span className="phr__tag">{it.note}</span>}
              </span>
              {!block.numbered && it.english && <span className="phr__en">{it.english}</span>}
            </div>
            <Speak id={`${id}:p${i}`} text={it.tulu} audio={audio} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function WordCard({ block, id, audio }) {
  return (
    <div className="blk blk--word">
      <div className="word__head">
        <div>
          <span className="kn word__tulu">{block.word}</span>
          <span className="word__roman">{block.roman}</span>
        </div>
        <Speak id={`${id}:w`} text={block.word} audio={audio} />
      </div>
      <p className="word__en">{block.english}</p>
      {block.frequency ? (
        <p className="word__freq">
          Appears <b>{block.frequency.toLocaleString()}</b> times in the {block.corpusLabel ?? "corpus"}
        </p>
      ) : null}
      {block.examples?.length > 0 && (
        <ul className="word__ex">
          {block.examples.map((ex, i) => (
            <li key={i}>
              <span className="kn">{ex}</span>
              <Speak id={`${id}:e${i}`} text={ex} audio={audio} label="Play example" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LipiGrid({ block, id, audio }) {
  const font = useGlyphSupport(LIPI_PROBES, '"Tulu Lipi", serif', LIPI_MISSING_REF);
  return (
    <div className="blk">
      <ul className="tiles">
        {block.letters.map((l, i) => {
          const key = `${id}:l${i}`;
          const drawable = l.lipi && font !== false;
          return (
            <li key={i}>
              <button
                type="button"
                className={`tile ${audio.playingKey === key ? "is-playing" : ""}`}
                onClick={() => audio.play(key, l.kannada)}
                aria-label={`Play the letter ${l.roman}`}
              >
                {drawable ? (
                  <span className="lipi tile__glyph">{l.lipi}</span>
                ) : (
                  <span className="kn-display tile__glyph tile__glyph--sub">{l.kannada}</span>
                )}
                <span className="tile__roman">{l.roman}</span>
                <span className={`tile__meta ${l.lipi ? "" : "is-none"}`}>
                  {drawable ? l.kannada : l.lipi ? l.cp : "not in Unicode"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {font === false && (
        <p className="blk__fine">
          No Tulu Lipi font on this device — showing each letter's Kannada counterpart and codepoint.
        </p>
      )}
    </div>
  );
}

function LetterGrid({ block, id, audio }) {
  return (
    <ul className="tiles tiles--kn">
      {block.letters.map((l, i) => {
        const key = `${id}:k${i}`;
        return (
          <li key={i}>
            <button
              type="button"
              className={`tile ${audio.playingKey === key ? "is-playing" : ""}`}
              onClick={() => audio.play(key, l.letter)}
              aria-label={`Play the letter ${l.roman}`}
            >
              <span className="kn-display tile__glyph">{l.letter}</span>
              <span className="tile__roman">{l.roman}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Story({ block, id, audio }) {
  return (
    <p className="blk story">
      {block.parts.map((p, i) =>
        typeof p === "string" ? (
          <span key={i}>{p}</span>
        ) : (
          <button
            key={i}
            type="button"
            className={`story__tulu kn ${audio.playingKey === `${id}:s${i}` ? "is-playing" : ""}`}
            onClick={() => audio.play(`${id}:s${i}`, p.tulu)}
            title={`${p.roman} — ${p.english}`}
          >
            {p.tulu}
            <span className="story__gloss">{p.english}</span>
          </button>
        )
      )}
    </p>
  );
}

/** Renders the structured parts of an assistant reply. */
export default function MessageBlocks({ blocks, id, audio, link }) {
  const navigate = useNavigate();
  return (
    <>
      {blocks.map((b, i) => {
        const key = `${id}:${i}`;
        const style = { animationDelay: `${i * 70}ms` };
        let body = null;
        switch (b.type) {
          case "text":
            body = <RichText text={b.text} className="blk__p" />;
            break;
          case "bullets":
            body = (
              <ul className="blk__bullets">
                {b.items.map((t, j) => (
                  <li key={j}>
                    <RichText text={t} as="span" />
                  </li>
                ))}
              </ul>
            );
            break;
          case "note":
            body = (
              <p className="blk__note">
                <Info size={13} />
                <span>{b.text}</span>
              </p>
            );
            break;
          case "phrases":
            body = <PhraseList block={b} id={key} audio={audio} />;
            break;
          case "word":
            body = <WordCard block={b} id={key} audio={audio} />;
            break;
          case "lipi":
            body = <LipiGrid block={b} id={key} audio={audio} />;
            break;
          case "letters":
            body = <LetterGrid block={b} id={key} audio={audio} />;
            break;
          case "story":
            body = <Story block={b} id={key} audio={audio} />;
            break;
          default:
            body = null;
        }
        return body ? (
          <div key={key} className="blk-wrap" style={style}>
            {body}
          </div>
        ) : null;
      })}
      {link && (
        <button type="button" className="blk-link" onClick={() => navigate(link.to)}>
          {link.label} <ArrowRight size={14} />
        </button>
      )}
    </>
  );
}
