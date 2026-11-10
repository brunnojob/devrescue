# Roadmap

A working list of where DevRescue is going. Anything here is open for
contribution — say so on an issue before starting so effort isn't duplicated.

## Done

- MIT license, real README, contributing guide, CI (lint + tests + build).
- Analyzer with 17 rules across 9 categories, tests beside the rules.
- Workbench: analyze, compare, environment checklist, opt-in history.
- Secret redaction before any display or export.

## Next

- **More coverage.** Common cases still missing: Node's `Cannot find module`,
  `EACCES`/permission denied, pnpm and yarn output shapes, CORS and HTTP 401/403,
  `cargo` and `go build` errors. Each needs a rule plus a test.
- **Remote history sync.** Wire the History tab to an authenticated
  `VITE_DEVRESCUE_API_URL` instead of `localStorage` only. The browser must never
  hold database credentials; it talks to that API and nothing else.
- **Rule authoring guide as a docs page**, so contributors do not need to read
  the source to add one.

## Ideas, not committed

- Import a log by URL for public CI artifacts.
- Shareable read-only report links.
- Per-project rule profiles (enable/disable rules).
