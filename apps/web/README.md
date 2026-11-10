# DevRescue

**Turn noisy logs into a fix plan — offline, in your browser.**

DevRescue is a deterministic, rule-based log analyzer for build, runtime, CI
and terminal output. It is not an AI model: every finding comes from a named
rule you can read in [`src/lib/analyzer.ts`](src/lib/analyzer.ts). Nothing you
paste is executed. Analysis stays offline; optional account sync sends a sanitized summary only after your explicit approval.

> It aims to save you debugging time. It cannot promise to solve every problem —
> always review a suggested command before running it.

## Preview

[Open the GitHub Pages entry](https://brunnojob.github.io/devrescue/) · [Open the hosted tool](https://log-sleuth-workbench.lovable.app)

![DevRescue access screen](https://log-sleuth-workbench.lovable.app/__l5e/assets-v1/5b5ca9eb-edfc-448f-85e7-352d58c6bdfd/devrescue-access.png)

### Access and documentation preview

![Real access and documentation screens](https://log-sleuth-workbench.lovable.app/__l5e/assets-v1/807fb01d-d9d6-4311-832c-ba1ed4808fc0/devrescue-preview.gif)

### Appearance gallery

![Eight DevRescue appearance themes](https://log-sleuth-workbench.lovable.app/__l5e/assets-v1/c5975b63-8504-4099-89a2-ac5588dcc35a/devrescue-appearance.gif)

Choose **English or Portuguese** in the header. Navigation, access status, documentation,
findings and warnings follow the selection; original log evidence and commands remain unchanged.
Choose **Graphite, Dim, Midnight, Forest, Light, Mint, Rose or Sandstone**. Both preferences
are saved in the current browser. These previews show the real access and documentation screens,
not a completed GitHub sign-in or a verified sponsor session.

## What it does

- **Redacts first.** Tokens (GitHub, OpenAI-style, AWS, npm, Slack), JWTs,
  `Authorization` headers, password/secret assignments, private keys and
  credentials inside connection URLs are scrubbed before anything is displayed
  or exported.
- **Detects and dedupes.** Each finding records its evidence lines, a location
  when one is present, an occurrence count and a confidence score. Repeats
  collapse into one finding.
- **Drops cascades.** A missing Python module supersedes the generic traceback;
  a specific PostgreSQL, DNS or TLS error supersedes a generic connection
  timeout.
- **Compares two logs.** See what a fix introduced, what it resolved, and what
  is still failing.
- **Exports.** JSON and Markdown reports, built from sanitized text only.

## Detected categories

| Category     | Examples                                                         |
| ------------ | ---------------------------------------------------------------- |
| `typescript` | `file.tsx:12:3 - error TS2304: ...` with file/line/column        |
| `python`     | `ModuleNotFoundError`, exception tracebacks with frame locations |
| `npm`        | `ERESOLVE` peer conflicts, missing scripts                       |
| `system`     | `ENOSPC` / watcher limits, `EADDRINUSE`, out-of-memory           |
| `docker`     | daemon unreachable, socket permission denied                     |
| `database`   | PostgreSQL connection/auth failures, migration errors            |
| `git`        | merge conflicts and unresolved conflict markers                  |
| `network`    | DNS resolution, TLS/certificate errors, timeouts                 |
| `tests`      | failing test summaries and assertion errors                      |

## Using it

Open the app, paste a log or pick a built-in sample, and press **Analyze**. The
four tabs are:

- **Analyze** — findings, filterable by text, category and severity.
- **Compare** — before/after diff of two logs.
- **Checklist** — a tickable environment checklist, saved in your browser.
- **History** — off by default; when enabled, sanitized sessions stay in this
  browser's `localStorage` and can be deleted per item or cleared.

## Safety

DevRescue never executes pasted text or commands. Suggested commands are copied
to your clipboard only — read them and their warnings first. Placeholders such
as `<port>` must be filled in by you.

## Development

Requires [Bun](https://bun.sh).

```sh
bun install
bun run dev      # local dev server
bun run test     # analyzer + routing tests
bun run lint     # eslint (prettier is enforced through eslint)
bun run format   # prettier --write
bun run build    # production build
```

### Hosted access and GitHub Pages

`pages-site/` is the static public entry at `https://brunnojob.github.io/devrescue/`.
Its separate GitHub Actions workflow deploys that directory only. In the canonical
repository, select **Settings → Pages → Source → GitHub Actions** after syncing
these source changes. The entry opens the separately hosted TanStack tool;
GitHub Pages cannot run its server functions or database connections.

Hosted users sign in to DevRescue, verify their GitHub identity and explicitly
start a three-hour trial. After three hours, any active monthly sponsorship or
confirmed one-time GitHub Sponsors payment to `brunnojob` grants access.
The trial cannot restart by clearing browser storage. Open-source copies remain
MIT licensed and locally executable; this is not DRM for the offline analyzer.

GitHub verification uses a per-user OAuth connector (offline access required),
with server-only encrypted connection keys. Register the connector callback
`https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback` in GitHub.
The additional access schema is **not automatically installed**:

```sh
bun scripts/migrate-access.ts  # review-only preflight; prints the file hash
bun scripts/migrate-access.ts --apply --schema-sha256=<reviewed-file-hash>
```

The script reads only server secret `MIGRATION_DATABASE_URL`, checks the base
and access layouts and uses mandatory verified TLS. Never edit or rerun the
installed base schema for this feature. Runtime uses `DATABASE_URL`.
Report sync remains opt-in, sends only re-redacted derived summaries and checks
session, CSRF and hosted access before listing or uploading. Users may still
delete their own reports after access expires.

## Contributing

Rules and their tests live side by side in `src/lib/analyzer.ts` and
`src/lib/analyzer.test.ts`. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to
add one — the short version is that the analyzer must stay pure: no network
calls, no command execution.

## License

[MIT](LICENSE) · © 2026 brunnodev

Support the project: [GitHub Sponsors](https://github.com/sponsors/brunnojob)
