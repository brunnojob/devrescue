<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.

<!-- LOVABLE:END -->

- Log analysis is a pure deterministic module (src/lib/analyzer.ts) with tests beside it; never add network calls or command execution there — keeps the tool offline and safe.
- No Lovable Cloud/Supabase; optional sync uses server functions (src/lib/sync.functions.ts) over the user's own PostgreSQL with server-only secrets, verified TLS, the isolated `devrescue` schema (db/devrescue-schema.sql, applied only via scripts/migrate-devrescue.ts with --apply and the reviewed file's sha256, after a column preflight that refuses incompatible layouts; never automatically, never dropping data), httpOnly SameSite=Strict session cookies plus a session-bound CSRF token — browser must never hold DB credentials or a shared API token.
- Synced reports are derived summaries built by src/lib/sync-report.ts and re-redacted server-side; never sync raw or full sanitized logs.
- CI (.github/workflows/ci.yml) runs lint, tests and build on every push and PR; fix lint errors instead of suppressing them, and never weaken the analyzer's purity rule to silence one.
- Report cap and lockout are enforced in single atomic SQL statements in src/lib/accounts.server.ts, tested against PGlite with the real schema — keeps them safe under concurrent requests.
- GitHub Pages publishes only pages-site via its own workflow and opens the separately hosted TanStack tool — static hosting cannot execute secure sessions or PostgreSQL calls.
- Hosted access uses an immutable GitHub identity, an atomic non-resettable trial start and server-verified sponsorship; connection keys are encrypted and OAuth completion is nonce- and session-bound — prevents browser-clock resets and cross-account grants.
- Additional access tables use the separately reviewed db/devrescue-access.sql and deliberate migrate-access script; never edit or automatically rerun the installed base migration — preserves live data.
- Language and appearance preferences share a root React provider; translate presentation only, never evidence or executable commands — keeps localization consistent without altering diagnostics.
- Theme variations override semantic CSS tokens in the global stylesheet — keeps controls and all routes consistent.
