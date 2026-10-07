import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import VoiceMenu from "./VoiceMenu";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/dictionary", label: "Dictionary" },
  { to: "/translate", label: "Translate" },
  { to: "/learn", label: "Learn" },
  { to: "/about", label: "About" },
];

/** Brand mark: a voice at the centre of an eight-petal mandala. */
function Mark() {
  const petals = Array.from({ length: 8 }, (_, i) => (
    <path
      key={i}
      d="M12 3.4 C13.6 5.6, 13.6 7, 12 8.6 C10.4 7, 10.4 5.6, 12 3.4 Z"
      transform={`rotate(${i * 45} 12 12)`}
      fill={i % 2 ? "var(--gold-soft)" : "var(--purple)"}
    />
  ));
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {petals}
      <circle cx="12" cy="12" r="3.1" fill="var(--purple)" />
      <circle cx="12" cy="12" r="6.4" stroke="var(--gold)" strokeWidth="0.8" opacity=".55" />
    </svg>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className={`nav ${location.pathname === "/" ? "nav--wide" : ""}`}>
      <div className="nav__inner">
        <NavLink to="/" className="nav__brand" aria-label="Tulu Mitra, home">
          <Mark />
          <span className="kn-display nav__brand-text">ತುಳು ಮಿತ್ರ</span>
        </NavLink>

        <nav className="nav__links" aria-label="Primary">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}
              className={({ isActive }) => `nav__link ${isActive ? "is-active" : ""}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav__tools">
          <VoiceMenu />
          <ThemeToggle />
          <UserMenu />
        </div>

        <button type="button" className="nav__toggle" onClick={() => setOpen((v) => !v)}
          aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div className={`nav__sheet ${open ? "is-open" : ""}`} aria-hidden={!open}>
        {LINKS.map((l, i) => (
          <NavLink key={l.to} to={l.to} end={l.end} tabIndex={open ? 0 : -1}
            style={{ transitionDelay: `${open ? 40 + i * 35 : 0}ms` }}
            className={({ isActive }) => `nav__sheet-link ${isActive ? "is-active" : ""}`}>
            {l.label}
          </NavLink>
        ))}
      </div>
    </header>
  );
}
