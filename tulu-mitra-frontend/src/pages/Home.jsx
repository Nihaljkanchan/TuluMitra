import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  BookOpen,
  Brain,
  Hash,
  MessageCircle,
  PanelLeft,
  ScrollText,
  SquarePen,
} from "lucide-react";
import MicButton from "../components/MicButton";
import StatusIndicator from "../components/StatusIndicator";
import ChatMessage from "../components/ChatMessage";
import TypingBubble from "../components/TypingBubble";
import ChatComposer from "../components/ChatComposer";
import ChatSidebar from "../components/ChatSidebar";
import VoiceUpload from "../components/VoiceUpload";
import VoiceOrb from "../components/VoiceOrb";
import Mandala from "../components/Mandala";
import LanguagePicker, { languageOf } from "../components/LanguagePicker";
import { useToast } from "../components/Toast";
import useRecorder from "../hooks/useRecorder";
import useAudioPlayer from "../hooks/useAudioPlayer";
import useConversations from "../hooks/useConversations";
import { asr, chat, isMockMode, tts } from "../services/api";
import { voiceMode } from "../services/indianVoice";
import { OPENERS } from "../data/tulu";
import { MY_NAME_IS } from "../data/greetings";
import AudioButton from "../components/AudioButton";
import useProfile, { editName } from "../hooks/useProfile";
import { buildGreeting } from "../services/greeting";
import { saveName } from "../services/profile";
import useSiteContent from "../hooks/useSiteContent";

const nextId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* Starting points on the welcome screen — each sends a real prompt. */
const STARTERS = [
  { icon: MessageCircle, title: "Say hello", hint: "Start a conversation in Tulu", prompt: "Hello! How are you?" },
  { icon: BookOpen, title: "Learn a lesson", hint: "Greetings, food, daily phrases", prompt: "Teach me greetings" },
  { icon: Hash, title: "Count in Tulu", hint: "Numbers from 1 to 100", prompt: "Count from 1 to 10" },
  { icon: Brain, title: "Quiz me", hint: "Practise words and keep score", prompt: "Quiz me" },
  { icon: ScrollText, title: "Tulu Lipi", hint: "Tulu's own historic script", prompt: "What is Tulu Lipi?" },
  { icon: MessageCircle, title: "Tell me a story", hint: "A short story with Tulu in it", prompt: "Tell me a story" },
];

const isWide = () => typeof window !== "undefined" && window.innerWidth > 960;

/* The last few turns, for a backend that supports multi-turn context. */
const historyOf = (messages) =>
  messages.slice(-10).map((m) => ({ role: m.role, text: m.text }));

export default function Home() {
  const conv = useConversations();
  const messages = useMemo(() => conv.active?.messages ?? [], [conv.active]);

  const [draft, setDraft] = useState("");
  const [inputLang, setInputLang] = useState("english");
  const [phase, setPhase] = useState("idle"); // idle | listening | processing | thinking
  const [typingId, setTypingId] = useState(null); // reply currently being typed out
  const [skipTyping, setSkipTyping] = useState(false);
  const [sideOpen, setSideOpen] = useState(isWide);
  const [showJump, setShowJump] = useState(false);

  const reqRef = useRef(0);
  const streamRef = useRef(null);
  const innerRef = useRef(null);
  const pinnedRef = useRef(true);
  const inputRef = useRef(null);

  const notify = useToast();
  const profile = useProfile();
  const content = useSiteContent();
  const greeting = useMemo(() => buildGreeting(profile, new Date(), content?.greetings), [profile, content]);
  const recorder = useRecorder();
  const player = useAudioPlayer();

  const started = messages.length > 0;
  const state = player.playingKey ? "speaking" : phase;
  const orbState = state === "thinking" ? "processing" : state;
  const lang = languageOf(inputLang);
  const generating = typingId !== null;

  useEffect(() => {
    if (recorder.error) notify(recorder.error);
  }, [recorder.error, notify]);

  useEffect(() => {
    if (player.error) notify(player.error);
  }, [player.error, notify]);

  /* ---------------------------------------------------------------- audio */

  const audio = useMemo(
    () => ({
      play: (key, text, url) => {
        const { mode } = voiceMode();
        return player.play(key, async () => (mode === "personal" ? tts(text) : (url ?? tts(text))), text);
      },
      playingKey: player.playingKey,
      loadingKey: player.loadingKey,
    }),
    [player]
  );

  /* ------------------------------------------------------------ scrolling
     Stay pinned to the newest message while a reply types out, unless the
     person has scrolled up to read something — then offer a jump button. */

  useEffect(() => {
    const inner = innerRef.current;
    const el = streamRef.current;
    if (!inner || !el) return undefined;
    const ro = new ResizeObserver(() => {
      if (pinnedRef.current) {
        el.scrollTop = el.scrollHeight;
        lastTopRef.current = el.scrollTop;
      }
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [started, conv.activeId]);

  /* Only an upward scroll unpins. Content growing under the view also makes
     "distance from bottom" jump, and must not be mistaken for the person
     scrolling away. */
  const lastTopRef = useRef(0);
  const onScroll = () => {
    const el = streamRef.current;
    if (!el) return;
    const top = el.scrollTop;
    const atBottom = el.scrollHeight - top - el.clientHeight < 80;
    if (atBottom) pinnedRef.current = true;
    else if (top < lastTopRef.current - 4) pinnedRef.current = false;
    lastTopRef.current = top;
    setShowJump(!pinnedRef.current && !atBottom);
  };

  const jump = () => {
    pinnedRef.current = true;
    setShowJump(false);
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: "smooth" });
  };

  /* ---------------------------------------------------------- switching */

  const cancelWork = useCallback(() => {
    reqRef.current += 1;
    setPhase("idle");
    setTypingId(null);
    player.stop();
  }, [player]);

  const openChat = (id) => {
    if (id === conv.activeId) return;
    cancelWork();
    if (recorder.isRecording) recorder.cancel();
    conv.select(id);
    pinnedRef.current = true;
    setShowJump(false);
    if (!isWide()) setSideOpen(false);
  };

  const newChat = () => {
    cancelWork();
    if (recorder.isRecording) recorder.cancel();
    conv.startNew();
    setDraft("");
    if (!isWide()) setSideOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  /* ------------------------------------------------------------- replies */

  const reply = useCallback(
    async ({ chatId, text, language, memory, history, replaceId, speakAfter }) => {
      const token = ++reqRef.current;
      setPhase("thinking");
      setSkipTyping(false);
      try {
        const r = await chat(text, language, { memory, history, with_audio: speakAfter });
        if (token !== reqRef.current) return; // stopped or switched chats
        const { memory: nextMemory, ...content } = r;
        const msg = {
          ...content,
          id: replaceId ?? nextId(),
          role: "assistant",
          fresh: true,
          createdAt: Date.now(),
        };
        if (replaceId) conv.replaceMessage(chatId, replaceId, msg);
        else conv.append(chatId, msg);
        conv.setMemory(chatId, nextMemory ?? memory);
        if (nextMemory?.name && nextMemory.name !== memory?.name) saveName(nextMemory.name);
        setTypingId(msg.id);
        // A spoken question gets a spoken answer.
        if (speakAfter && msg.lang !== "english" && msg.text) {
          const { mode } = voiceMode();
          player.play(
            msg.id,
            async () => (mode === "personal" && !msg.personalised ? tts(msg.text) : (msg.audioUrl ?? tts(msg.text))),
            msg.text
          );
        }
      } catch {
        if (token !== reqRef.current) return;
        const msg = {
          id: replaceId ?? nextId(),
          role: "assistant",
          lang: "english",
          text: "Unable to connect to the assistant. Please try again.",
          error: true,
          suggestions: ["Try again"],
          createdAt: Date.now(),
        };
        if (replaceId) conv.replaceMessage(chatId, replaceId, msg);
        else conv.append(chatId, msg);
      } finally {
        if (token === reqRef.current) setPhase("idle");
      }
    },
    [conv, player]
  );

  const converse = useCallback(
    (text, language, viaVoice = false) => {
      const chatMemory = conv.active?.memory ?? {};
      // The assistant knows the name given on the first visit.
      const memory = profile.name && !chatMemory.name ? { ...chatMemory, name: profile.name } : chatMemory;
      const userMsg = {
        id: nextId(),
        role: "user",
        text,
        language,
        viaVoice,
        memBefore: memory,
        createdAt: Date.now(),
      };
      const history = historyOf(messages);
      let chatId = conv.activeId;
      if (chatId) conv.append(chatId, userMsg);
      else chatId = conv.create(userMsg);
      pinnedRef.current = true;
      setShowJump(false);
      reply({ chatId, text, language, memory, history, speakAfter: viaVoice });
    },
    [conv, messages, reply, profile.name]
  );

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastBot = messages[messages.length - 1]?.role === "assistant" ? messages[messages.length - 1] : null;

  const regenerate = () => {
    if (!lastUser || !lastBot || !conv.activeId) return;
    const idx = messages.findIndex((m) => m.id === lastUser.id);
    reply({
      chatId: conv.activeId,
      text: lastUser.text,
      language: lastUser.language,
      memory: lastUser.memBefore ?? {},
      history: historyOf(messages.slice(0, idx)),
      replaceId: lastBot.id,
    });
  };

  const send = (text) => {
    if (!text.trim()) return;
    setDraft("");
    converse(text.trim(), inputLang);
  };

  const suggest = (s) => {
    if (s === "Try again" && lastUser) {
      if (lastBot?.error) {
        regenerate();
        return;
      }
      converse(lastUser.text, lastUser.language);
      return;
    }
    // Quiz options and Kannada-script suggestions are Tulu; the rest is English.
    const quizOption = conv.active?.memory?.quiz && !/^(hint|skip|stop quiz)$/i.test(s);
    const language = /[ಀ-೿]/.test(s) || quizOption ? "tulu" : "english";
    converse(s, language);
  };

  const stop = () => {
    if (phase === "thinking") {
      reqRef.current += 1;
      setPhase("idle");
      return;
    }
    if (generating) setSkipTyping(true);
    player.stop();
  };

  /* Once a reply has typed out, it never animates again (e.g. on reopening). */
  const finishTyping = useCallback(
    (id) => {
      setTypingId(null);
      if (conv.activeId) conv.replaceMessage(conv.activeId, id, { fresh: false });
    },
    [conv]
  );

  const edit = (m) => {
    setDraft(m.text);
    if (m.language) setInputLang(m.language);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  /* --------------------------------------------------------------- voice */

  const toggleMic = async () => {
    if (recorder.isRecording) {
      setPhase("processing");
      const blob = await recorder.stop();
      if (!blob) {
        setPhase("idle");
        notify("We couldn't understand the audio. Please try again.");
        return;
      }
      try {
        const { text } = await asr(blob, inputLang);
        if (!text?.trim()) throw new Error("empty");
        converse(text.trim(), inputLang, true);
      } catch {
        setPhase("idle");
        notify("We couldn't understand the audio. Please try again.");
      }
      return;
    }
    player.stop();
    const ok = await recorder.start();
    setPhase(ok ? "listening" : "idle");
  };

  /* ------------------------------------------------------------- render */

  return (
    <div className={`chatapp ${sideOpen ? "" : "is-collapsed"}`}>
      <ChatSidebar
        chats={conv.chats}
        activeId={conv.activeId}
        onNew={newChat}
        onSelect={openChat}
        onRename={conv.rename}
        onDelete={(id) => {
          if (id === conv.activeId) cancelWork();
          conv.remove(id);
        }}
        open={sideOpen}
        onClose={() => setSideOpen(false)}
        mockMode={isMockMode}
      />

      <section className="chatmain">
        <header className="chatbar">
          <button
            type="button"
            className="chatbar__btn"
            onClick={() => setSideOpen((v) => !v)}
            aria-label={sideOpen ? "Hide chats" : "Show chats"}
            aria-expanded={sideOpen}
            title={sideOpen ? "Hide chats" : "Show chats"}
          >
            <PanelLeft size={18} />
          </button>
          <h1 className="chatbar__title">{conv.active?.title ?? "New chat"}</h1>
          <button type="button" className="chatbar__btn" onClick={newChat} aria-label="New chat" title="New chat">
            <SquarePen size={17} />
          </button>
        </header>

        <div className="chatbody" ref={streamRef} onScroll={onScroll}>
          {!started ? (
            <section className="welcome">
              <div className="welcome__ring">
                <Mandala size={250} className="stage__mandala" />
                <MicButton state={orbState} onToggle={toggleMic} getLevel={recorder.getLevel} size={164} />
              </div>
              <p className="welcome__lead">{greeting.lead}</p>
              <h2 className="kn-display welcome__title" lang="tcy">
                {greeting.headline.tulu}
              </h2>
              <div className="welcome__q">
                <span className="kn welcome__q-tulu" lang="tcy">
                  {greeting.question.tulu}
                </span>
                <span className="welcome__q-meaning">
                  <i>{greeting.question.roman}</i> · {greeting.question.english}
                </span>
                <AudioButton
                  compact
                  label="Listen"
                  playing={player.playingKey === "greeting"}
                  loading={player.loadingKey === "greeting"}
                  onClick={() => audio.play("greeting", `${greeting.headline.tulu} ${greeting.question.tulu}`)}
                />
              </div>

              {profile.name && !greeting.returning && (
                <p className="welcome__tip">
                  Say your name in Tulu:{" "}
                  <b className="kn" lang="tcy">
                    {MY_NAME_IS.tulu(profile.name)}
                  </b>{" "}
                  <i>({MY_NAME_IS.roman(profile.name)})</i> — {MY_NAME_IS.english(profile.name)}
                </p>
              )}

              <p className="welcome__desc">
                <span className="kn-display welcome__brand">ತುಳು ಮಿತ್ರ</span> · Talk to me in English, Kannada
                or Tulu, by voice or text. I reply in Tulu with the English meaning, and I can teach,
                translate and quiz you along the way.
              </p>
              <button type="button" className="welcome__name" onClick={editName}>
                {profile.name ? `Not ${profile.name}? Change name` : "Tell me your name"}
              </button>

              <StatusIndicator state={state === "idle" ? null : state} />

              <div className="starters">
                {STARTERS.map(({ icon: Icon, title, hint, prompt }) => (
                  <button key={title} type="button" className="starter" onClick={() => converse(prompt, "english")}>
                    <Icon size={17} strokeWidth={1.8} />
                    <span className="starter__title">{title}</span>
                    <span className="starter__hint">{hint}</span>
                  </button>
                ))}
              </div>

              <div className="stage__openers">
                <span className="hint">Or try in {lang.name}</span>
                {OPENERS[inputLang].map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`chip ${lang.script === "kn" ? "kn" : ""}`}
                    onClick={() => converse(o, inputLang)}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <div className="thread" ref={innerRef} aria-live="polite" aria-label="Conversation">
              {messages.map((m, i) => (
                <ChatMessage
                  key={m.id}
                  message={m}
                  question={m.role === "assistant" ? [...messages.slice(0, i)].reverse().find((x) => x.role === "user")?.text : undefined}
                  audio={audio}
                  isLast={i === messages.length - 1}
                  busy={phase !== "idle" || generating}
                  skipTyping={skipTyping && m.id === typingId}
                  onTyped={m.id === typingId ? () => finishTyping(m.id) : undefined}
                  onRegenerate={regenerate}
                  onEdit={m.role === "user" ? edit : undefined}
                  onSuggest={suggest}
                />
              ))}
              {phase === "thinking" && <TypingBubble />}
            </div>
          )}
        </div>

        <div className="chatdock">
          {showJump && started && (
            <button type="button" className="jump" onClick={jump} aria-label="Scroll to latest message">
              <ArrowDown size={16} />
            </button>
          )}

          {started && state !== "idle" && state !== "thinking" && (
            <div className="dock__voice">
              <VoiceOrb state={orbState} getLevel={recorder.getLevel} size={56} />
              <StatusIndicator state={state} />
              {state === "listening" && (
                <button
                  type="button"
                  className="btn btn--quiet"
                  onClick={() => {
                    recorder.cancel();
                    setPhase("idle");
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          <LanguagePicker value={inputLang} onChange={setInputLang} />

          <ChatComposer
            value={draft}
            onChange={setDraft}
            onSend={send}
            onMic={toggleMic}
            onStop={stop}
            state={state}
            generating={generating}
            inputRef={inputRef}
            language={lang}
          />

          <div className="dock__extras">
            <VoiceUpload />
            <p className="hint dock__hint">
              <AlertCircle size={13} /> Voice samples are sent to the project backend for processing.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
