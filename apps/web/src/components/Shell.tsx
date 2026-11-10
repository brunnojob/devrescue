import { usePreferences } from "@/lib/preferences";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Languages, Palette } from "lucide-react";
import { THEMES, type Theme, type Language } from "@/lib/preferences";
import logo from "@/assets/devrescue-logo.png";
import { Button } from "./ui/button";
export const REPO = "https://github.com/brunnojob/devrescue";
export const SPONSOR = "https://github.com/sponsors/brunnojob";
export function Shell({ children }: { children: ReactNode }) {
  const { t, language, theme, setLanguage, setTheme } = usePreferences();
  return (
    <div className="min-h-screen bg-background bg-grid font-sans text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-mono text-lg font-semibold">
            <img src={logo} alt="" width={36} height={36} className="size-9 object-contain" />
            Dev<span className="text-primary">Rescue</span>
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link
              to="/"
              activeProps={{ className: "text-primary" }}
              activeOptions={{ exact: true }}
            >
              {" "}
              {t("Workbench")}{" "}
            </Link>
            <Link to="/docs" activeProps={{ className: "text-primary" }}>
              {" "}
              {t("Docs")}{" "}
            </Link>
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
            <label
              className="flex items-center gap-1.5 rounded border border-border px-2 py-1.5"
              title={t("Language")}
            >
              <Languages className="size-4 text-muted-foreground" />
              <select
                aria-label={t("Language")}
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
                className="max-w-24 bg-background text-sm outline-none"
              >
                <option value="en">English</option>
                <option value="pt">Português</option>
              </select>
            </label>
            <label
              className="flex items-center gap-1.5 rounded border border-border px-2 py-1.5"
              title={t("Appearance")}
            >
              <Palette className="size-4 text-primary" />
              <select
                aria-label={t("Appearance")}
                value={theme}
                onChange={(event) => setTheme(event.target.value as Theme)}
                className="max-w-28 bg-background text-sm outline-none"
              >
                {THEMES.map((value) => (
                  <option key={value} value={value}>
                    {t(value.charAt(0).toUpperCase() + value.slice(1))}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="outline" size="sm" asChild>
              <a href={REPO} target="_blank" rel="noreferrer">
                GitHub
              </a>
            </Button>
            <Button size="sm" asChild>
              <a href={SPONSOR} target="_blank" rel="noreferrer">
                {" "}
                {t("♥ Sponsor")}{" "}
              </a>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        {" "}
        {t("DevRescue is open source by brunnodev (")}{" "}
        <a className="text-primary" href="https://github.com/brunnojob">
          @brunnojob
        </a>{" "}
        {t(
          "). Suggestions are pattern-based and may not solve every problem — always review before running.",
        )}{" "}
      </footer>
    </div>
  );
}
