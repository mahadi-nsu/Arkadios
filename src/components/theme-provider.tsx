"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Theme, THEME_STORAGE_KEY } from "@/lib/theme";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({ theme: "light", setTheme: () => undefined });
export const useTheme = () => useContext(ThemeContext);

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setCurrentTheme] = useState<Theme>("light");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(THEME_STORAGE_KEY);
      } catch {
        /* Theme switching still works without storage. */
      }
      const next =
        saved === "light" || saved === "dark"
          ? saved
          : media.matches
            ? "dark"
            : "light";
      applyTheme(next);
      setCurrentTheme(next);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) update();
    };
    update();
    media.addEventListener("change", update);
    window.addEventListener("storage", storage);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("storage", storage);
    };
  }, []);
  const value = useMemo(
    () => ({
      theme,
      setTheme: (next: Theme) => {
        applyTheme(next);
        setCurrentTheme(next);
        try {
          localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          /* Retain the active theme for this session. */
        }
      },
    }),
    [theme],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={`Switch to ${next} theme`}
      title={`Current: ${theme} · Switch to ${next} theme`}
      onClick={() => setTheme(next)}
    >
      {theme === "dark" ? (
        <Moon size={16} aria-hidden="true" />
      ) : (
        <Sun size={16} aria-hidden="true" />
      )}
      <span>{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
