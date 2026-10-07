import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Loader2, Search, SearchX, Sparkles, Volume2, Square } from "lucide-react";
import { dictionary, dictionaryIndex, tts } from "../services/api";
import { useToast } from "../components/Toast";
import ReportMistake from "../components/ReportMistake";
import AudioButton from "../components/AudioButton";
import useAudioPlayer from "../hooks/useAudioPlayer";

const TRY = ["water", "neer", "ನೀರ್", "ನೀರು", "how are you", "ಹೆಸರು", "45", "nir", "ಯಕ್ಷಗಾನ", "ಮಂಗಳೂರು"];

const KN = /[ಀ-೿]/;

/* Small round play control for sentences and list rows. */
function Speak({ id, text, player }) {
  const playing = player.playingKey === id;
  const loading = player.loadingKey === id;
  return (
    <button
      type="button"
      className={`speak ${playing ? "is-playing" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        player.play(id, () => tts(text), text);
      }}
      aria-label={playing ? "Stop audio" : `Play: ${text}`}
    >
      {loading ? <Loader2 size={13} className="spin" /> : playing ? <Square size={10} fill="currentColor" /> : <Volume2 size={14} />}
    </button>
  );
}

/* A card built from the backend's simpler response (word, frequency, examples). */
const legacyCard = (r) => ({
  word: r.word,
  roman: r.roman,
  english: r.english,
  meanings: r.english ? [r.english] : [],
  kannada: [],
  frequency: r.frequency,
  examples: r.examples,
  usedIn: [],
  sources: ["Project corpus"],
  matchedBy: null,
});

export default function Dictionary() {
  const [term, setTerm] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);
  const inputRef = useRef(null);
  const notify = useToast();
  const player = useAudioPlayer();
  const index = useMemo(() => dictionaryIndex(), []);

  const run = async (raw) => {
    const word = raw.trim();
    const id = ++reqRef.current;
    if (!word) {
      setResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await dictionary(word);
      if (id !== reqRef.current) return;
      setResult({ ...data, query: word });
    } catch {
      if (id !== reqRef.current) return;
      notify("Unable to connect to the dictionary. Please try again.");
    } finally {
      if (id === reqRef.current) setLoading(false);
    }
  };

  /* Search as you type, after a short pause. */
  useEffect(() => {
    const t = setTimeout(() => run(term), 280);
    return () => clearTimeout(t);
  }, [term]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (word) => {
    setTerm(word);
    run(word);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const card = result ? result.card ?? (result.found ? legacyCard(result) : null) : null;
  const notFound = result && !card && !loading;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Tulu dictionary</h1>
        <p>
          Search in English, Tulu or Kannada — in Kannada script or Latin letters. Each word shows
          its meaning, its Kannada equivalent, where it is used, and example sentences from the
          corpus.
        </p>
      </header>

      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          run(term);
        }}
      >
        <Search size={18} className="search__icon" aria-hidden="true" />
        <input
          ref={inputRef}
          className={`search__input ${KN.test(term) ? "kn" : ""}`}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="water, neer, ನೀರ್ or ನೀರು…"
          aria-label="Search the Tulu dictionary"
          autoFocus
        />
        <button type="submit" className="btn btn--primary" disabled={!term.trim() || loading}>
          {loading ? <Loader2 size={16} className="spin" /> : "Search"}
        </button>
      </form>

      <div className="dict-try">
        <span className="hint">Try</span>
        {TRY.map((t) => (
          <button key={t} type="button" className={`chip chip--sm ${KN.test(t) ? "kn" : ""}`} onClick={() => open(t)}>
            {t}
          </button>
        ))}
      </div>

      {loading && !result && (
        <div className="dict">
          <div className="skeleton" style={{ height: 150 }} />
          <div className="skeleton" style={{ height: 120, marginTop: 14 }} />
        </div>
      )}

      {/* ------------------------------------------------------ nothing typed */}
      {!term.trim() && !loading && (
        <>
          {!index && (
            <div className="empty">
              <BookOpen size={22} />
              <h2>Search for a Tulu word</h2>
              <p>Results show corpus frequency alongside example sentences.</p>
            </div>
          )}
          {index && (
            <section className="browse">
              <div className="browse__head">
                <h2>Browse the word list</h2>
                <p className="hint">
                  {index.size} Tulu words and phrases with English and Kannada meanings, plus the
                  numbers 1–100 — tap any to open it. Any other Tulu word can be searched in
                  Kannada script to see how often the Tulu Wikipedia corpus uses it, with example
                  sentences.
                </p>
              </div>
              {index.groups.map((g) =>
                g.items.length ? (
                  <div key={g.id} className="browse__group">
                    <h3>{g.label}</h3>
                    <div className="browse__items">
                      {g.items.map((it) => (
                        <button key={it.tulu} type="button" className="bword" onClick={() => open(it.tulu)}>
                          <span className="kn bword__tulu">{it.tulu}</span>
                          <span className="bword__en">{it.english}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            </section>
          )}
        </>
      )}

      {/* ---------------------------------------------------------- no match */}
      {notFound && term.trim() && (
        <div className="empty">
          <SearchX size={22} />
          <h2>No match for “{result.query}”</h2>
          <p>
            {index
              ? `It isn't in the word list (${index.size} words and phrases) or among the corpus words searchable here. Try the English meaning, the Tulu in Kannada script or Latin letters, or the Kannada word.`
              : "Check the spelling in Kannada script, or try a shorter root form."}
          </p>
          <ReportMistake
            kind="dictionary"
            page="dictionary"
            input={result.query}
            shown={/[ಀ-೿]/.test(result.query) ? { tulu: result.query } : { english: result.query }}
            label="Suggest this word"
            title="Suggest a word for the dictionary"
          />
        </div>
      )}

      {/* ------------------------------------------------------------ result */}
      {card && term.trim() && (
        <div className={`dict dict-grid ${loading ? "is-stale" : ""}`}>
          <div className="dict-main">
            {result.fuzzy && (
              <p className="dict-fuzzy">
                <Sparkles size={14} /> No exact match for “{result.query}” — showing the closest word.
              </p>
            )}

            <article className="dict__head dict-card">
              <div className="dict-card__body">
                <p className="dict__label">
                  Tulu
                  {card.matchedBy && <span className="dict-tag">matched by {card.matchedBy.replace(/^English/, "English").replace(/^Similar/, "similar").replace(/^Sounds/, "sounds")}</span>}
                </p>
                <h2 className="kn dict__word">{card.word}</h2>
                {card.roman && <p className="dict__roman">{card.roman}</p>}

                <dl className="dict-facts">
                  {card.meanings?.length > 0 && (
                    <div>
                      <dt>English</dt>
                      <dd>{card.meanings.join(" · ")}</dd>
                    </div>
                  )}
                  {card.kannada?.length > 0 && (
                    <div>
                      <dt>Kannada</dt>
                      <dd className="kn">{card.kannada.join(" · ")}</dd>
                    </div>
                  )}
                  {card.sources?.length > 0 && (
                    <div>
                      <dt>Source</dt>
                      <dd className="dict-sources">
                        {card.sources.map((s) => (
                          <span key={s} className="dict-source">
                            {s}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
                {card.composed && (
                  <p className="hint dict-note">
                    Written as tens word + unit word; the spoken, fused form varies by region.
                  </p>
                )}
                <div className="dict-card__acts">
                  <AudioButton
                    onClick={() => player.play("word", () => tts(card.word), card.word)}
                    playing={player.playingKey === "word"}
                    loading={player.loadingKey === "word"}
                    label="Hear it"
                  />
                  <ReportMistake
                    kind="dictionary"
                    page="dictionary"
                    input={result.query}
                    shown={{ tulu: card.word, roman: card.roman || "", english: card.english || "" }}
                  />
                </div>
              </div>

              {card.frequency ? (
                <div className="dict__freq">
                  <span className="dict__count">{card.frequency.toLocaleString()}</span>
                  <span className="hint">occurrences in corpus</span>
                </div>
              ) : null}
            </article>

            {card.examples?.length > 0 && (
              <section className="dict__examples">
                <h3>Example sentences</h3>
                <ul>
                  {card.examples.map((ex, i) => (
                    <li key={i} className="dict-row">
                      <span className="kn">{ex}</span>
                      <Speak id={`ex${i}`} text={ex} player={player} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {card.usedIn?.length > 0 && (
              <section className="dict__examples">
                <h3>Used in these phrases</h3>
                <ul>
                  {card.usedIn.map((p) => (
                    <li key={p.tulu} className="dict-row dict-row--link" onClick={() => open(p.tulu)}>
                      <span>
                        <span className="kn">{p.tulu}</span>
                        <span className="dict-row__sub">
                          {p.roman} — {p.english}
                        </span>
                      </span>
                      <Speak id={`u-${p.tulu}`} text={p.tulu} player={player} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {result.sentences?.length > 0 && (
              <section className="dict__examples">
                <h3>Also found in corpus sentences</h3>
                <ul>
                  {result.sentences.map((s, i) => (
                    <li key={i} className="dict-row">
                      <span className="kn">{s.text}</span>
                      <Speak id={`s${i}`} text={s.text} player={player} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {result.related?.length > 0 && (
            <aside className="dict-side">
              <h3>Other matches</h3>
              <ul>
                {result.related.map((r) => (
                  <li key={r.tulu}>
                    <button type="button" className="dict-rel" onClick={() => open(r.tulu)}>
                      <span className="kn dict-rel__tulu">{r.tulu}</span>
                      <span className="dict-rel__sub">
                        {r.roman} · {r.english}
                      </span>
                      <span className="dict-rel__how">{r.matchedBy}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
