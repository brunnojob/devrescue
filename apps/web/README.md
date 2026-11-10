# DevRescue

**Turn noisy logs into a fix plan — offline, in your browser.**

DevRescue is a deterministic, rule-based log analyzer for build, runtime, CI
and terminal output. It is not an AI model: every finding comes from a named
rule you can read in [`src/lib/analyzer.ts`](src/lib/analyzer.ts). Nothing you paste is executed. Analysis stays local; only an explicitly reviewed derived summary can be uploaded through account sync.

> It aims to save you debugging time. It cannot promise to solve every problem —
> always review a suggested command before running it.

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

### Optional Azure account sync

The History tab includes an authenticated server API backed by the existing Azure PostgreSQL server. Add `DATABASE_URL` only in server Secrets; never use a `VITE_*` variable for credentials. Account sessions use httpOnly Secure cookies and CSRF validation. Review a sanitized summary before explicitly uploading it; full logs are not sent. See the repository's [Azure guide](../../docs/AZURE.md), `db/devrescue-schema.sql`, and the deliberate migration/verification scripts in `scripts/`.

Live database connectivity is not yet verified. The legacy root `server/` API has a different table layout and is not the backend used here.

## Contributing

Rules and their tests live side by side in `src/lib/analyzer.ts` and
`src/lib/analyzer.test.ts`. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to
add one — the short version is that the analyzer must stay pure: no network
calls, no command execution.

## License

[MIT](LICENSE) · © 2026 brunnodev

Support the project: [GitHub Sponsors](https://github.com/sponsors/brunnojob)
