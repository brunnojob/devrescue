import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
export const REPO = "https://github.com/brunnojob/devrescue";
export const SPONSOR = "https://github.com/sponsors/brunnojob";
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background bg-grid font-sans text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-mono text-lg font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded bg-primary text-primary-foreground">
              ⛑
            </span>
            Dev<span className="text-primary">Rescue</span>
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link
              to="/"
              activeProps={{ className: "text-primary" }}
              activeOptions={{ exact: true }}
            >
              Workbench
            </Link>
            <Link to="/docs" activeProps={{ className: "text-primary" }}>
              Docs
            </Link>
          </nav>
          <div className="ml-auto flex gap-2 text-sm">
            <a
              href={REPO}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-border px-3 py-1.5 hover:border-primary"
            >
              GitHub
            </a>
            <a
              href={SPONSOR}
              target="_blank"
              rel="noreferrer"
              className="rounded bg-primary px-3 py-1.5 font-medium text-primary-foreground shadow-glow"
            >
              ♥ Sponsor
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        DevRescue is open source by brunnodev (
        <a className="text-primary" href="https://github.com/brunnojob">
          @brunnojob
        </a>
        ). Suggestions are pattern-based and may not solve every problem — always review before
        running.
      </footer>
    </div>
  );
}
