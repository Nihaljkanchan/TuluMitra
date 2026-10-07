import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { recordVisit } from "./services/profile";
import "./styles/global.css";
import "./styles/components.css";
import "./styles/pages.css";
import "./styles/chat.css";

// Count this visit (once per browser session) before the first render,
// so the welcome greeting knows whether this is a first or returning visit.
recordVisit();

// A link like /?voice=<id> (printed by training/make_voice_reference.py)
// makes this browser use that voice for "My voice".
try {
  const v = new URLSearchParams(window.location.search).get("voice");
  if (v && /^[a-f0-9]{16}$/.test(v)) {
    localStorage.setItem("tulumitra:voiceId", v);
    localStorage.setItem("tulumitra:voice", "personal");
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }
} catch {
  /* storage blocked */
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
