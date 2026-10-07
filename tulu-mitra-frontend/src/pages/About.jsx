import { Mic, Languages, BookOpen, GraduationCap, UserRound } from "lucide-react";
import Mandala from "../components/Mandala";

const CAPABILITIES = [
  { icon: Mic, title: "Voice interaction", body: "Speech is transcribed by the ASR model, answered by the conversational layer, and spoken back through text-to-speech." },
  { icon: Languages, title: "Translation", body: "Text moves between English, Kannada and Tulu, with spoken output for the Tulu side." },
  { icon: BookOpen, title: "Corpus lookup", body: "Dictionary search reports how often a word appears in the Tulu corpus and shows the sentences it appears in." },
  { icon: GraduationCap, title: "Guided learning", body: "Phrases, numbers to one hundred and the script, each with audio playback and progress tracking." },
];

const STACK = ["Python", "Flask", "ASR", "NLP", "Conversational AI", "TTS", "React", "Git / GitHub"];

export default function About() {
  return (
    <div className="page about">
      <header className="about__head">
        <Mandala size={330} className="about__mandala" />
        <h1 className="kn-display about__title">ತುಳು ಮಿತ್ರ</h1>
        <p className="about__sub">AI-powered Tulu voice assistant</p>
        <p className="about__lede">
          Tulu is spoken by millions of people along the Karnataka and Kerala coast, yet almost
          no everyday software understands it. Tulu Mitra is a working attempt to close part of
          that gap: a single place to speak Tulu, be understood, and hear an answer back.
        </p>
      </header>

      <section className="about__grid">
        {CAPABILITIES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="about__item">
            <Icon size={18} strokeWidth={1.7} />
            <h2>{title}</h2>
            <p>{body}</p>
          </div>
        ))}
      </section>

      <section className="about__row">
        <div>
          <h2 className="about__h">Why it matters</h2>
          <p className="about__body">
            Speech technology is built where data is plentiful. Languages without large digital
            corpora fall out of the interfaces people use daily. Building an assistant around
            Tulu — collecting audio, transcribing it, and generating speech — puts the language
            into a form that software can work with, and gives learners a way in.
          </p>
        </div>
        <div>
          <h2 className="about__h">Personalised voice</h2>
          <p className="about__body">
            A short recording, spoken live or uploaded, can be used to generate responses in a
            familiar voice. The sample is sent to the project backend for processing.
          </p>
        </div>
      </section>

      <section className="about__row about__row--meta">
        <div>
          <h2 className="about__h">Team</h2>
          <ul className="people">
            <li><UserRound size={15} /> Abhishek Nayak</li>
            <li><UserRound size={15} /> Nihal</li>
          </ul>
          <p className="hint" style={{ marginTop: 12 }}>
            Department of Artificial Intelligence and Machine Learning<br />
            Canara Engineering College
          </p>
        </div>
        <div>
          <h2 className="about__h">Built with</h2>
          <ul className="tags">
            {STACK.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      </section>
    </div>
  );
}
