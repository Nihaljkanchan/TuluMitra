import useAuth from "../hooks/useAuth";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MessageSquare, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { deriveSummary } from "../hooks/useConversations";

const DAY = 86400000;

function groupOf(ts) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = start.getTime();
  if (ts >= today) return "Today";
  if (ts >= today - DAY) return "Yesterday";
  if (ts >= today - 7 * DAY) return "Previous 7 days";
  if (ts >= today - 30 * DAY) return "Previous 30 days";
  return "Older";
}

const ORDER = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"];

const timeLabel = (ts) => {
  const d = new Date(ts);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
};

function ChatRow({ chat, active, onSelect, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [value, setValue] = useState(chat.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!confirming) return undefined;
    const id = setTimeout(() => setConfirming(false), 3500);
    return () => clearTimeout(id);
  }, [confirming]);

  const commit = () => {
    onRename(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="side-chat is-editing">
        <input
          ref={inputRef}
          className="side-chat__input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={commit}
          aria-label="Rename chat"
          maxLength={60}
        />
        <button type="button" className="side-chat__icon" onMouseDown={commit} aria-label="Save name">
          <Check size={14} />
        </button>
      </li>
    );
  }

  return (
    <li className={`side-chat ${active ? "is-active" : ""}`}>
      <button type="button" className="side-chat__main" onClick={onSelect} aria-current={active ? "true" : undefined}>
        <span className="side-chat__title">{chat.title}</span>
        <span className="side-chat__summary">{deriveSummary(chat)}</span>
      </button>
      <span className="side-chat__time">{timeLabel(chat.updatedAt)}</span>
      <span className="side-chat__actions">
        {confirming ? (
          <>
            <button type="button" className="side-chat__confirm" onClick={onDelete}>
              Delete
            </button>
            <button type="button" className="side-chat__icon" onClick={() => setConfirming(false)} aria-label="Keep chat">
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="side-chat__icon"
              onClick={() => {
                setValue(chat.title);
                setEditing(true);
              }}
              aria-label={`Rename ${chat.title}`}
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              className="side-chat__icon"
              onClick={() => setConfirming(true)}
              aria-label={`Delete ${chat.title}`}
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </span>
    </li>
  );
}

/**
 * The conversation sidebar: start a new chat, search, and reopen any
 * previous chat, each with a one-line summary of what it covered.
 */
export default function ChatSidebar({
  chats,
  activeId,
  onNew,
  onSelect,
  onRename,
  onDelete,
  open,
  onClose,
  mockMode,
}) {
  const auth = useAuth();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? chats.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.messages.some((m) => (m.text || "").toLowerCase().includes(q))
        )
      : chats;
    const map = new Map();
    for (const c of filtered) {
      const g = groupOf(c.updatedAt);
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(c);
    }
    return ORDER.filter((g) => map.has(g)).map((g) => [g, map.get(g)]);
  }, [chats, query]);

  return (
    <>
      <div className={`side-scrim ${open ? "is-open" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside className={`side ${open ? "is-open" : ""}`} aria-label="Chats">
        <div className="side__top">
          <button type="button" className="side__new" onClick={onNew}>
            <Plus size={17} strokeWidth={2.2} />
            New chat
          </button>
          <button type="button" className="side__close" onClick={onClose} aria-label="Close chats">
            <X size={18} />
          </button>
        </div>

        {chats.length > 0 && (
          <label className="side__search">
            <Search size={14} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              aria-label="Search chats"
            />
          </label>
        )}

        <nav className="side__list">
          {chats.length === 0 ? (
            <div className="side__empty">
              <MessageSquare size={20} strokeWidth={1.6} />
              <p>Your chats will appear here.</p>
              <p className="hint">Each one is saved with a short summary so you can pick it up later.</p>
            </div>
          ) : groups.length === 0 ? (
            <p className="side__none">No chats match “{query}”.</p>
          ) : (
            groups.map(([label, list]) => (
              <section key={label} className="side__group">
                <h3 className="side__label">{label}</h3>
                <ul>
                  {list.map((c) => (
                    <ChatRow
                      key={c.id}
                      chat={c}
                      active={c.id === activeId}
                      onSelect={() => onSelect(c.id)}
                      onRename={(t) => onRename(c.id, t)}
                      onDelete={() => onDelete(c.id)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </nav>

        <footer className="side__foot">
          <span className={`side__mode ${mockMode ? "is-demo" : "is-live"}`}>
            <i />
            {mockMode ? "Demo mode" : "Connected to backend"}
          </span>
          <p className="hint">
            {mockMode
              ? "Answers come from the project's built-in Tulu data."
              : "Answers come from the Tulu Mitra backend."}{" "}
            {auth?.mode === "google" ? "Chats are saved to your account." : "Chats are saved in this browser."}
          </p>
        </footer>
      </aside>
    </>
  );
}
