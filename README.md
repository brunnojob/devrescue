<div align="center">

# DevRescue
### Developer friction, diagnosed.

Turn noisy build logs into evidence and practical next steps.<br>Catch environment drift before it becomes another broken afternoon. ( 3 hours free, after sponsor any value to get full acess lifetime, just a one payment for lifetime acess )

[![CI](https://github.com/brunnojob/devrescue/actions/workflows/ci.yml/badge.svg)](https://github.com/brunnojob/devrescue/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-c3f66c)](LICENSE)
[![Node](https://img.shields.io/badge/node-22%2B-c3f66c)](package.json)
[![Sponsor](https://img.shields.io/badge/Sponsor-brunnodev-ea4aaa?logo=githubsponsors)](https://github.com/sponsors/brunnojob)

[Open workbench](https://brunnojob.github.io/devrescue/) · [Português](README.pt-BR.md) · [Support development](https://github.com/sponsors/brunnojob) · [Limits & privacy](docs/LIMITATIONS.md)

</div>

## From a broken build to an investigation path

```text
src/api.ts(45,7): error TS2322: Type 'string' is not assignable to type 'number'.
```

DevRescue groups repeated diagnostics, keeps `src/api.ts:45:7`, explains which compiler constraint failed and suggests how to reproduce the check. It does not invent a code patch when the source and intended behavior are unknown.

**No paid AI API. No required account. No automatic execution of log-derived commands.** The core runs locally with Node.js 22+ and has zero runtime dependencies.

## Try it

```sh
git clone https://github.com/brunnojob/devrescue.git
cd devrescue
node bin/devrescue.js analyze examples/build.log
node bin/devrescue.js doctor .
```

Or use the GitHub package directly (requires Git and network on first install; not published to npm):

```sh
npx --yes github:brunnojob/devrescue analyze path/to/build.log
```

## The annoying work it handles

| Pain | What works today |
| --- | --- |
| Hundreds of noisy CI lines | ANSI stripping, rule matching, repeated-signature grouping and evidence |
| “Where did it break?” | TypeScript locations and Python traceback frames when present |
| Broken dependency installs | npm peer conflicts, lockfile mismatch, missing scripts, JS/Python imports |
| Works locally, fails in CI | Runtime declaration, lockfile, script and environment-name checks |
| Docker and runner failures | Daemon, architecture, permissions, memory, disk and port signatures |
| Database problems | PostgreSQL authentication, connection and migration signatures |
| Network surprises | DNS and TLS diagnostics without disabling certificate checks |
| Git and tests | Conflict markers, merge failures and assertion signatures |
| “Is this the same error?” | Before/after log comparison with new, absent and recurring signatures |
| Repeating incident notes | Sanitized Markdown/JSON export and opt-in local browser history |
| Forgot to ignore credentials | Explicitly reviewed `.gitignore` patch with backup and stale-file checks |
| Sharing CI evidence | GitHub Action job summaries with common-secret redaction |

Twenty rule families are heuristics. Unknown failures remain unknown. See [the exact limits](docs/LIMITATIONS.md).

## CLI

```sh
# Pipe an existing log; this does not execute the original build
cat build.log | node bin/devrescue.js analyze -
node bin/devrescue.js analyze build.log --json
node bin/devrescue.js analyze build.log --fail-on-findings
node bin/devrescue.js compare before.log after.log
node bin/devrescue.js doctor /path/to/project

# Preview first; only this narrow fix is supported in v0.1
node bin/devrescue.js fix /path/to/project
node bin/devrescue.js fix /path/to/project --apply ignore-env
```

Exit codes: `0` completed analysis (not proof of a successful build), `1` findings with `--fail-on-findings`, `2` invalid input or operation error. Backups use `.devrescue.backup`; review and restore them manually if needed. No destructive cleanup, forced installs or arbitrary auto-patches.

## GitHub Action

```yaml
- uses: actions/checkout@v4
- name: Build and capture output
  shell: bash
  run: |
    set -o pipefail
    npm run build 2>&1 | tee build.log
- uses: brunnojob/devrescue@main # Pin a reviewed commit SHA in production
  if: always()
  with:
    log-path: build.log
```

The original build remains failed when it fails. DevRescue appends a sanitized Markdown job summary and prints the report. A missing log is an input error. The analyzer does not fetch private workflow logs or post comments with elevated permissions.

## Browser and Azure

The root `index.html` imports the same `src/engine.js` as the CLI and Action. Serve the checkout over HTTP, for example `python -m http.server 8080`, then open localhost:8080. Paste/upload logs, inspect findings, compare incidents and export reports. Raw logs are not persisted. History is optional and local.

The full-stack [Lovable application](https://lovable.dev/projects/40c635c4-c8fc-4d94-82d8-338c46515291) now has per-user account sync. Its source is in [`apps/web`](apps/web), including the authenticated server functions, PostgreSQL adapter, isolated schema and migration/verification scripts. The static GitHub Pages workbench remains local-only.

See [Azure setup and current connection status](docs/AZURE.md). **Live Azure connectivity is not yet verified.** The full-stack app uses per-user sessions in httpOnly secure cookies, CSRF checks, and explicitly reviewed sanitized summaries. It never sends full logs to the database. The older `server/` service-token API remains a standalone single-owner prototype and is not used by the full-stack application.

## Sponsor useful maintenance

[♥ Sponsor brunnodev](https://github.com/sponsors/brunnojob) to help fund maintained rules, reproducible fixtures and compatibility work. Suggested voluntary support: **$5/month** for individuals and **$10/month** for frequent users. These are suggestions, not configured GitHub tier claims or paid feature gates.

The core remains MIT open source. Sponsorship is not a promise that every error can be fixed or that revenue is guaranteed. Per-user history code is implemented in `apps/web`, pending verified Azure connectivity and deployment. Stronger language-aware source patches and production SaaS hardening remain future work.

## Quality and contribution

```sh
npm test
npm run demo
npm pack --dry-run
```

CI runs on Linux, Windows and macOS with Node 22 and 24. Tests cover rule fixtures, deduplication, locations, false positives, redaction, comparison, patch backup/staleness, symlinks and API authorization. Azure integration has not been tested against a live server.

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). Start with a sanitized failing fixture and its expected diagnostic. Do not submit real credentials or private incident logs.

Built by [Brunno / brunnodev](https://brunnodev.store). Related tools: [CIFuse](https://github.com/brunnojob/cifuse), [PatchScope](https://github.com/brunnojob/patchscope). This is a new implementation; those repositories were not modified.
