import Segmented from "./Segmented";

export const LANGUAGES = [
  { id: "kannada", label: "ಕನ್ನಡ", name: "Kannada", script: "kn" },
  { id: "english", label: "English", name: "English", script: "latin" },
  { id: "tulu", label: "ತುಳು", name: "Tulu", script: "kn" },
];

export const languageOf = (id) => LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];

/**
 * Sits directly above the composer. It answers one question — what language
 * am I about to type or speak? — and states the outcome, which is always Tulu.
 */
export default function LanguagePicker({ value, onChange }) {
  return (
    <div className="langpick">
      <span className="langpick__label">I'll speak or type in</span>
      <Segmented
        options={LANGUAGES.map((l) => ({ id: l.id, label: l.label }))}
        value={value}
        onChange={onChange}
        label="Input language"
        scroll
      />
      <span className="langpick__out kn">→ ತುಳು</span>
    </div>
  );
}
