import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  RotateCcw,
} from "lucide-react";
import Segmented from "../components/Segmented";
import AudioButton from "../components/AudioButton";
import ProgressRing from "../components/ProgressRing";
import { LESSON_CATEGORIES } from "../data/tulu";
import { NUMBER_PAGES, NUMBER_TOTAL, SCRIPT_GROUPS, SCRIPT_TOTAL } from "../data/learnExtras";
import { LIPI_GROUPS, LIPI_TOTAL, LIPI_PROBES, LIPI_MISSING_REF } from "../data/tuluLipi";
import { tts } from "../services/api";
import useAudioPlayer from "../hooks/useAudioPlayer";
import useProgress from "../hooks/useProgress";
import useGlyphSupport from "../hooks/useGlyphSupport";
import { useToast } from "../components/Toast";
import ReportMistake from "../components/ReportMistake";
import useSiteContent from "../hooks/useSiteContent";

const SECTIONS = [
  { id: "phrases", label: "Phrases" },
  { id: "numbers", label: "Numbers 1–100" },
  { id: "lipi", label: "Tulu Lipi" },
  { id: "script", label: "Kannada script" },
];

const phraseTotal = (cats) => cats.reduce((n, c) => n + c.items.length, 0);

const TOTALS = {
  numbers: NUMBER_TOTAL,
  lipi: LIPI_TOTAL,
  script: SCRIPT_TOTAL,
};

const UNITS = {
  phrases: "sentences",
  numbers: "numbers",
  lipi: "letters",
  script: "letters",
};

const BLURBS = {
  phrases: "Start from the English meaning, read the Tulu in Kannada script or in Latin letters, then play it to hear how it sounds.",
  numbers: "Counting from one to one hundred, ten at a time. Play any number to hear it.",
  lipi: "Tulu Lipi — the Tulu-Tigalari script, the writing system that belongs to Tulu itself. Each letter is shown with its sound and its Kannada counterpart.",
  script: "The Kannada script, which is what Tulu is written in day to day and what the project corpus uses.",
};

export default function Learn() {
  const [section, setSection] = useState("phrases");
  // Lessons edited on the Admin page when the backend is connected;
  // the built-in lessons otherwise.
  const content = useSiteContent();
  const categories = content?.lessons?.length ? content.lessons : LESSON_CATEGORIES;
  const [categoryId, setCategoryId] = useState(LESSON_CATEGORIES[0].id);
  const [pageIndex, setPageIndex] = useState(0);
  const [groupId, setGroupId] = useState(SCRIPT_GROUPS[0].id);

  const player = useAudioPlayer();
  const { listened, mark, resetSection, countIn } = useProgress();
  const notify = useToast();
  /* Can this device draw Tulu Lipi at all? null while the check runs. */
  const lipiFont = useGlyphSupport(LIPI_PROBES, '"Tulu Lipi", serif', LIPI_MISSING_REF);

  const category = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? categories[0],
    [categories, categoryId]
  );
  const group = useMemo(() => SCRIPT_GROUPS.find((g) => g.id === groupId), [groupId]);
  const page = NUMBER_PAGES[pageIndex];

  const done = countIn(section);
  const total = section === "phrases" ? phraseTotal(categories) : TOTALS[section];

  /* One play path for every kind of item, so audio behaves identically
     across phrases, numbers and letters. */
  const listen = async (key, text) => {
    const ok = await player.play(key, () => tts(text), text);
    if (ok) mark(key);
  };

  useEffect(() => {
    if (player.error) notify(player.error);
  }, [player.error, notify]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Learn Tulu</h1>
        <p>{BLURBS[section]}</p>
      </header>

      <div className="learn__bar">
        <Segmented
          options={SECTIONS}
          value={section}
          onChange={setSection}
          label="What to learn"
          scroll
        />
        <div className="progress">
          <ProgressRing value={done} total={total} />
          <div>
            <h2 className="progress__title">Your progress</h2>
            <p className="hint">
              {done} / {total} {UNITS[section]} listened
            </p>
            {done > 0 && (
              <button
                type="button"
                className="btn btn--quiet progress__reset"
                onClick={() => resetSection(section)}
              >
                <RotateCcw size={13} /> Reset this section
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ---------------- Phrases ---------------- */}
      {section === "phrases" && (
        <>
          <div className="learn__sub">
            <Segmented
              options={categories.map((c) => ({ id: c.id, label: c.label }))}
              value={category.id}
              onChange={setCategoryId}
              label="Lesson categories"
              scroll
            />
          </div>

          <p className="learn__blurb">
            <span className="kn-display learn__cat-kn">{category.kn}</span>
            {category.blurb}
          </p>

          <ul className="lessons">
            {category.items.map((item, i) => {
              const key = `phrases:${category.id}:${i}`;
              const isDone = listened.has(key);
              return (
                <li key={key} className={`lesson ${isDone ? "is-done" : ""}`}>
                  <div className="lesson__body">
                    <p className="lesson__en">{item.english}</p>
                    <p className="kn lesson__tulu">{item.tulu}</p>
                    {item.roman && <p className="lesson__roman">{item.roman}</p>}
                  </div>
                  <div className="lesson__side">
                    {isDone && (
                      <span className="lesson__done" title="Listened">
                        <Check size={13} />
                      </span>
                    )}
                    <AudioButton
                      onClick={() => listen(key, item.tulu)}
                      playing={player.playingKey === key}
                      loading={player.loadingKey === key}
                      compact
                    />
                    <ReportMistake
                      compact
                      kind="lesson"
                      page="learn"
                      input={item.tulu}
                      shown={{ tulu: item.tulu, roman: item.roman || "", english: item.english || "" }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* ---------------- Numbers 1–100 ---------------- */}
      {section === "numbers" && (
        <>
          <div className="learn__sub">
            <Segmented
              options={NUMBER_PAGES.map((p) => ({ id: p.id, label: p.label }))}
              value={page.id}
              onChange={(id) => setPageIndex(NUMBER_PAGES.findIndex((p) => p.id === id))}
              label="Number range"
              scroll
            />
          </div>

          <div className="pager">
            <button
              type="button"
              className="btn btn--ghost pager__btn"
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
              disabled={pageIndex === 0}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <span className="pager__count">
              {page.from}–{page.to} <span className="hint">of {NUMBER_TOTAL}</span>
            </span>
            <button
              type="button"
              className="btn btn--ghost pager__btn"
              onClick={() => setPageIndex((i) => Math.min(NUMBER_PAGES.length - 1, i + 1))}
              disabled={pageIndex === NUMBER_PAGES.length - 1}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>

          <ul className="numbers">
            {page.items.map((item) => {
              const key = `numbers:${item.value}`;
              const isDone = listened.has(key);
              return (
                <li key={key} className={`num ${isDone ? "is-done" : ""}`}>
                  <span className="num__value">{item.value}</span>
                  <div className="num__body">
                    <p className="kn num__tulu">{item.tulu}</p>
                    <p className="num__roman">{item.roman}</p>
                  </div>
                  <div className="num__side">
                    {isDone && (
                      <span className="lesson__done" title="Listened">
                        <Check size={13} />
                      </span>
                    )}
                    <AudioButton
                      onClick={() => listen(key, item.tulu)}
                      playing={player.playingKey === key}
                      loading={player.loadingKey === key}
                      compact
                    />
                    <ReportMistake
                      compact
                      kind="lesson"
                      page="learn"
                      input={item.tulu}
                      shown={{ tulu: item.tulu, roman: item.roman || "", english: item.english || "" }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="learn__note">
            <Info size={14} />
            <span>
              Tulu numbers from 1 to 100 with accurate single-word numerals and pronunciations.
              Play any number to hear it spoken aloud.
            </span>
          </p>
        </>
      )}

      {/* ---------------- Tulu Lipi ---------------- */}
      {section === "lipi" && (
        <>
          {lipiFont === false && (
            <div className="lipi-warn">
              <AlertTriangle size={17} />
              <div>
                <h3>Tulu Lipi Font Notice</h3>
                <p>
                  Authentic Tulu-Tigalari script characters are displayed above. If characters appear as boxes on your system,
                  please check that webfonts are enabled in your browser settings.
                </p>
              </div>
            </div>
          )}

          {LIPI_GROUPS.map((g) => (
            <section key={g.id} className="lipi-group">
              <h2 className="lipi-group__head">
                <span className="kn-display lipi-group__kn">{g.kn}</span>
                {g.label}
              </h2>

              <ul className="letters letters--lipi">
                {g.letters.map((l, i) => {
                  const key = `lipi:${g.id}:${i}`;
                  const isDone = listened.has(key);
                  const active = player.playingKey === key;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        className={`letter letter--lipi ${isDone ? "is-done" : ""} ${
                          active ? "is-playing" : ""
                        }`}
                        onClick={() => listen(key, l.kannada)}
                        aria-label={`Play the letter ${l.roman}`}
                      >
                        {l.lipi ? (
                          <span className="lipi letter__glyph">{l.lipi}</span>
                        ) : (
                          <span className="kn-display letter__glyph letter__glyph--sub">
                            {l.kannada}
                          </span>
                        )}

                        <span className="letter__roman">{l.roman}</span>

                        <span className="kn letter__kn">{l.kannada}</span>

                        {isDone && (
                          <span className="letter__done" aria-hidden="true">
                            <Check size={11} />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <p className="learn__note">
            <Info size={14} />
            <span>
              Tulu Lipi is encoded in Unicode 16.0 as the Tulu-Tigalari block,
              U+11380–U+113FF; every codepoint here was checked against its official
              character name. Short <b>e</b> and short <b>o</b> carry no letter because
              Unicode has not encoded them yet — only the long forms exist, and a proposal
              to add the short ones is still open. Playing a card speaks its Kannada
              counterpart, which is the same sound.
            </span>
          </p>
        </>
      )}

      {/* ---------------- Kannada script ---------------- */}
      {section === "script" && (
        <>
          <div className="learn__sub">
            <Segmented
              options={SCRIPT_GROUPS.map((g) => ({ id: g.id, label: g.label }))}
              value={groupId}
              onChange={setGroupId}
              label="Letter groups"
              scroll
            />
          </div>

          <p className="learn__blurb">
            <span className="kn-display learn__cat-kn">{group.kn}</span>
            {group.note}
          </p>

          <ul className="letters">
            {group.letters.map((l, i) => {
              const key = `script:${group.id}:${i}`;
              const isDone = listened.has(key);
              const active = player.playingKey === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    className={`letter ${isDone ? "is-done" : ""} ${active ? "is-playing" : ""}`}
                    onClick={() => listen(key, l.letter)}
                    aria-label={`Play the letter ${l.roman}`}
                  >
                    <span className="kn-display letter__glyph">{l.letter}</span>
                    <span className="letter__roman">{l.roman}</span>
                    {isDone && (
                      <span className="letter__done" aria-hidden="true">
                        <Check size={11} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="learn__note">
            <Info size={14} />
            <span>
              This is the Kannada script — what Tulu is written in day to day, and the
              script the project corpus is stored in. Tulu's own script has its own
              section above.
            </span>
          </p>
        </>
      )}
    </div>
  );
}
