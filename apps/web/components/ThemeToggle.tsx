"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const KEY = "playgolite:theme";

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Theme | null;
      if (saved === "light" || saved === "dark") {
        setTheme(saved);
        apply(saved);
      }
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  const next = () => {
    const order: Theme[] = ["system", "light", "dark"];
    const t = order[(order.indexOf(theme) + 1) % order.length] as Theme;
    setTheme(t);
    apply(t);
    try {
      if (t === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch {
      /* ignore */
    }
  };

  const label = theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark";
  return (
    <button className="btn" onClick={next} aria-label={`Theme: ${label}. Tap to change.`}>
      {label}
    </button>
  );
}
