import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Every conversation, saved in this browser (localStorage) so the sidebar
 * can list past chats and reopen them — the way a chat app should behave.
 *
 * Nothing here is sent anywhere. Clearing site data clears the history.
 */

const KEY = "tulumitra:chats:v1";
const MAX_CHATS = 60;

const GREETING_ONLY = /^(hi+|hello+|hey+|namaste|namaskara?|good (morning|afternoon|evening)|ಸೊಲ್ಮೆಲು|ನಮಸ್ಕಾರ|ok|okay|thanks?)\W*$/i;

const makeId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function save(chats) {
  try {
    // `fresh` only drives the typing animation for a reply that just arrived.
    const clean = chats.map((c) => ({
      ...c,
      messages: c.messages.map(({ fresh, ...m }) => ({
        ...m,
        audioUrl: m.audioUrl?.startsWith("blob:") ? null : m.audioUrl ?? null,
      })),
    }));
    localStorage.setItem(KEY, JSON.stringify(clean.slice(0, MAX_CHATS)));
  } catch {
    /* storage full or blocked — history just won't persist */
  }
}

/* A title from the first message that says something. */
export function deriveTitle(messages) {
  const users = messages.filter((m) => m.role === "user");
  const first = users.find((m) => !GREETING_ONLY.test(m.text.trim())) ?? users[0];
  if (!first) return "New chat";
  const t = first.text.trim().replace(/\s+/g, " ").replace(/[?.!]+$/, "");
  const titled = t.charAt(0).toUpperCase() + t.slice(1);
  return titled.length > 44 ? `${titled.slice(0, 42).trimEnd()}…` : titled;
}

/* A one-line summary of what the chat covered, built from reply topics. */
export function deriveSummary(chat) {
  const topics = [];
  for (const m of chat.messages) {
    if (m.role !== "assistant" || !m.topic) continue;
    const t = m.topic.replace(/^Lesson · /, "Lesson: ");
    if (!topics.includes(t)) topics.push(t);
  }
  const meaningful = topics.filter((t) => t !== "Chat" && t !== "Help");
  const shown = (meaningful.length ? meaningful : topics).slice(0, 3);
  const turns = chat.messages.filter((m) => m.role === "user").length;
  const quiz = chat.memory?.quiz;
  const bits = [];
  if (shown.length) bits.push(shown.join(" · "));
  if (quiz && quiz.asked > 1) bits.push(`quiz ${quiz.score}/${quiz.asked - 1}`);
  bits.push(`${turns} message${turns === 1 ? "" : "s"}`);
  return bits.join(" — ");
}

export default function useConversations() {
  const [chats, setChats] = useState(load);
  const [activeId, setActiveId] = useState(null); // null = a fresh, unsaved chat
  const saveTimer = useRef(null);

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(chats), 250);
    return () => clearTimeout(saveTimer.current);
  }, [chats]);

  const active = useMemo(() => chats.find((c) => c.id === activeId) ?? null, [chats, activeId]);

  const patch = useCallback((id, fn) => {
    setChats((list) => {
      const i = list.findIndex((c) => c.id === id);
      if (i === -1) return list;
      const updated = fn(list[i]);
      const next = [...list];
      next.splice(i, 1);
      return [updated, ...next]; // most recently touched first
    });
  }, []);

  /* Start a chat with its first message; returns the new id. */
  const create = useCallback((firstMessage) => {
    const id = makeId();
    const now = Date.now();
    const chat = {
      id,
      title: deriveTitle([firstMessage]),
      titleLocked: false,
      createdAt: now,
      updatedAt: now,
      memory: {},
      messages: [firstMessage],
    };
    setChats((list) => [chat, ...list].slice(0, MAX_CHATS));
    setActiveId(id);
    return id;
  }, []);

  const append = useCallback(
    (id, message) =>
      patch(id, (c) => {
        const messages = [...c.messages, message];
        return {
          ...c,
          messages,
          updatedAt: Date.now(),
          title: c.titleLocked ? c.title : deriveTitle(messages),
        };
      }),
    [patch]
  );

  const replaceMessage = useCallback(
    (id, messageId, next) =>
      setChats((list) =>
        list.map((c) =>
          c.id === id
            ? { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...next } : m)) }
            : c
        )
      ),
    []
  );

  const setMemory = useCallback(
    (id, memory) => setChats((list) => list.map((c) => (c.id === id ? { ...c, memory } : c))),
    []
  );

  const rename = useCallback(
    (id, title) =>
      setChats((list) =>
        list.map((c) => (c.id === id ? { ...c, title: title.trim() || c.title, titleLocked: true } : c))
      ),
    []
  );

  const remove = useCallback(
    (id) => {
      setChats((list) => list.filter((c) => c.id !== id));
      setActiveId((cur) => (cur === id ? null : cur));
    },
    []
  );

  return {
    chats,
    active,
    activeId,
    select: setActiveId,
    startNew: () => setActiveId(null),
    create,
    append,
    replaceMessage,
    setMemory,
    rename,
    remove,
  };
}
