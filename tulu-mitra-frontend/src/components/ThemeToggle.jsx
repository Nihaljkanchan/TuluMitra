import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { currentTheme, followSystem, setTheme } from "../services/theme";

/** Navbar button that switches between the light and dark theme. */
export default function ThemeToggle() {
  const [theme, setThemeState] = useState(currentTheme);

  useEffect(() => followSystem(setThemeState), []);

  const next = theme === "dark" ? "light" : "dark";
  const label = `Switch to ${next} theme`;

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => {
        setTheme(next);
        setThemeState(next);
      }}
      aria-label={label}
      title={label}
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
