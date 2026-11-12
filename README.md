<div align="center">
<img src="apps/web/src/assets/devrescue-logo.png" width="100" alt="DevRescue" />

# DevRescue

**Less log noise. Clear evidence. Reviewed fixes.**

[![CI](https://github.com/brunnojob/devrescue/actions/workflows/ci.yml/badge.svg)](https://github.com/brunnojob/devrescue/actions/workflows/ci.yml)
[![Pages](https://github.com/brunnojob/devrescue/actions/workflows/pages.yml/badge.svg)](https://github.com/brunnojob/devrescue/actions/workflows/pages.yml)
[![MIT](https://img.shields.io/badge/license-MIT-91cb58)](LICENSE)
[![Sponsor](https://img.shields.io/badge/Sponsor-brunnojob-ea4aaa?logo=githubsponsors)](https://github.com/sponsors/brunnojob)

[Open workbench](https://brunnojob.github.io/devrescue/) · [Português](README.pt-BR.md) · [Azure setup](docs/AZURE.md) · [Sponsor](https://github.com/sponsors/brunnojob)
</div>

DevRescue isolates recognizable failures from build, runtime and CI logs, shows the evidence and available file/line, and suggests a concrete next step. It is deterministic, open source, and does not execute suggested commands. It cannot diagnose every failure or guarantee a fix in ten seconds.

## What is included

- **Log analysis:** grouped signatures, redacted evidence, available source locations, likely causes and commands to review.
- **Diagnosis:** source excerpts supplied by the user, stack-specific hints and a step-by-step repair plan.
- **Compare, checklist and history:** compare two logs, track manual checks, keep opt-in browser history, export Markdown/JSON.
- **Eight themes:** Graphite, Dim, Midnight, Forest, Light, Mint, Rose and Sandstone, plus English/Portuguese.
- **Own account API:** email/password accounts, per-user sessions, CSRF, direct GitHub OAuth with PKCE and GitHub Sponsors verification.
- **Azure sync:** explicitly upload a reviewed derived report to the existing PostgreSQL database; raw/full logs stay local.
- **CLI and GitHub Action:** no runtime dependencies for local troubleshooting; the root CLI also checks repository setup and offers a narrowly scoped, reviewed `.env` ignore fix.

## Native GitHub + Azure architecture

| Component | Runs on | Source |
| --- | --- | --- |
| React/Vite interface | GitHub Pages | [`apps/web/src`](apps/web/src) |
| Account, OAuth, sponsorship and report API | Azure App Service, Node.js 22 | [`apps/web/api`](apps/web/api) |
| Existing users, sessions and reports | Azure PostgreSQL with verified TLS | [`apps/web/db`](apps/web/db) |
| Tests and deployment | GitHub Actions | [Workflows](.github/workflows) |
| Funding | GitHub Sponsors | [brunnojob](https://github.com/sponsors/brunnojob) |

The Pages application loads directly, with no iframe or external app-building runtime. Hash routes preserve navigation on Pages; old `/tool.html` links redirect to the native app.

**Deployment status:** the frontend workflow is ready for Pages. The independent Azure API needs the existing runtime's settings, direct GitHub OAuth credentials and OIDC deployment authorization described in [docs/AZURE.md](docs/AZURE.md). A green build does not verify the real database. If the public API URL is not configured, account access displays a setup message. The existing Azure database and schemas are preserved; no remote migration is performed by this change.

GitHub Pro and Developer Program benefits can support the workflow, but Pages serves static files only; it does not host Node or PostgreSQL. No paid Azure resource is automatically created by this repository.

## Local development

```sh
git clone https://github.com/brunnojob/devrescue.git
cd devrescue/apps/web
npm ci
npm run dev
```

Use `/devrescue/` locally. For account features set the public `VITE_API_BASE_URL` in a private `.env.local`; set server secrets in the API process environment as described in the Azure guide. Build and run the independent API with `npm run api:build && npm run api:start`. Keep an existing database encryption key unchanged during migration.

## Dependency-free CLI

From the repository root, with Node.js 22+:

```sh
node bin/devrescue.js analyze examples/build.log --markdown
node bin/devrescue.js analyze examples/build.log --json
node bin/devrescue.js doctor .
```

The root CLI and Action use the repository troubleshooting engine. The web app includes its newer browser analyzer and a separately tested compiled CLI companion under `apps/web/bin`. Both are signature-based; findings may differ. Neither uploads logs or runs suggestions.

## GitHub Action

```yaml
- uses: actions/checkout@v4
- name: Analyze an existing log
  if: always()
  uses: brunnojob/devrescue@main # Pin a reviewed commit SHA in production.
  with:
    log-path: ./ci.log
    fail-on-findings: 'false'
```

Create `ci.log` in an earlier step. The action does not download job logs automatically. It writes sanitized Markdown to the job summary and supports Linux, Windows and macOS, including the older Bash shipped on macOS.

## Validation

```sh
# Root CLI and Action package
npm test
npm run demo
npm pack --dry-run
# Web, database behavior and API boundary
cd apps/web
npm ci
npm test
npm run lint
npm run build
npm run typecheck
npm run api:build
```

Database isolation and trial behavior are tested with PGlite, without touching production. Real Azure connectivity must be checked separately using the deployment guide.

## Privacy and support

Redaction is pattern-based. Review every report before sharing or uploading it. Account features make explicit API calls; browser analysis itself does not send logs to a model or analytics service. See [limitations](docs/LIMITATIONS.md) and [security](SECURITY.md).

Support maintenance through [GitHub Sponsors](https://github.com/sponsors/brunnojob). Hosted access retains the three-hour trial tied to a verified GitHub identity and sponsor access for monthly or confirmed one-time support. Server-side access checks protect report operations. The source and local CLI remain MIT licensed.
