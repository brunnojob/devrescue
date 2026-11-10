import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import portuguese from "./translations-pt.json";
export type Language = "en" | "pt";
export const THEMES = [
  "graphite",
  "dim",
  "midnight",
  "forest",
  "light",
  "mint",
  "rose",
  "sandstone",
] as const;
export type Theme = (typeof THEMES)[number];
const translations: Record<string, string> = portuguese;
export function translate(text: string, language: Language): string {
  return language === "pt" ? (translations[text] ?? text) : text;
}
const Preferences = createContext({
  language: "en" as Language,
  theme: "graphite" as Theme,
  setLanguage: (_: Language) => {},
  setTheme: (_: Theme) => {},
  t: (text: string) => text,
});
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<Theme>("graphite");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const savedLanguage = localStorage.getItem("devrescue.language");
    const savedTheme = localStorage.getItem("devrescue.theme");
    if (savedLanguage === "pt" || savedLanguage === "en") setLanguage(savedLanguage);
    if (THEMES.some((value) => value === savedTheme)) setTheme(savedTheme as Theme);
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
    document.documentElement.dataset["theme"] = theme;
    document.documentElement.classList.toggle(
      "dark",
      !["light", "mint", "rose", "sandstone"].includes(theme),
    );
    localStorage.setItem("devrescue.language", language);
    localStorage.setItem("devrescue.theme", theme);
  }, [language, theme, ready]);
  return (
    <Preferences.Provider
      value={{ language, theme, setLanguage, setTheme, t: (text) => translate(text, language) }}
    >
      {children}
    </Preferences.Provider>
  );
}
export function usePreferences() {
  return useContext(Preferences);
}
