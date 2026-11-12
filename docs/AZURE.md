# GitHub Pages + Azure API

The frontend is a native static build on GitHub Pages. The Node.js 22 API runs separately on Azure App Service and connects to the existing PostgreSQL server `rg-db-wallmarket.postgres.database.azure.com:5432`. GitHub Pages cannot execute a backend or open PostgreSQL connections. Pro and Developer Program membership do not turn Pages into a Node host or guarantee Azure credit.

## What this migration preserves

The PostgreSQL adapter, verified TLS, `devrescue.users`, sessions, reports, and access tables retain their existing layout. Deployments never run schema migrations and never replace the database. The older single-owner REST prototype has been retired; the new account API lives in `apps/web/api`.

As of 2026-11-12, local builds and automated tests validate the code. The owner reports the Azure database is already connected. A live database probe and independent API deployment have not been verified in this migration; do not infer production connectivity from a green build or `/health` alone.

## 1. Configure the existing Azure runtime privately

Use a Linux App Service with Node.js 22 and startup command `npm start`. Use the existing app if one is already available. This repository does not create a paid hosting plan, subscription, replacement database, or firewall exception.

Set these App Service application settings; never commit their values:

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | Existing database, least-privilege app user, URL-encoded credentials; host remains `rg-db-wallmarket.postgres.database.azure.com` |
| `PGSSLROOTCERT_PEM` | Optional trusted CA PEM if required by the runtime; certificate verification remains enabled |
| `PUBLIC_SITE_URL` | `https://brunnojob.github.io/devrescue/` |
| `API_ORIGIN` | The independent HTTPS API origin, for example `https://YOUR-API.azurewebsites.net` |
| `GITHUB_CLIENT_ID` | Your GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Its server-side secret |
| `TOKEN_ENCRYPTION_KEY` | Base64-encoded 32-byte encryption key; retain the original key for existing records |

For transition only, the previous key name `APP_USER_CONNECTION_KEY_SECRET` is accepted if `TOKEN_ENCRYPTION_KEY` is absent. Do not rotate the value accidentally: existing encrypted records cannot be decrypted with another key. Existing users and reports remain; users previously linked through a different OAuth gateway must use **Reconnect GitHub** to replace their connection token with a direct GitHub token. Never delete access rows or reset trial timestamps as a migration shortcut.

Configure a GitHub **OAuth App** owned by brunnojob with homepage `https://brunnojob.github.io/devrescue/` and callback `${API_ORIGIN}/api/public/github/return`. The app uses `read:user`, direct identity verification, state and PKCE. The secret stays on Azure; no token exchange runs on Pages. Tokens are encrypted at rest. Sponsor checks query the authenticated user's sponsorships of `brunnojob`; errors fail closed and cannot grant paid access.

Keep existing database network controls. The App Service must already be permitted to reach the database through its approved network path. Never disable TLS verification or allow every Internet address to make a connection test pass.

## 2. Authorize GitHub Actions for the existing app

Use Azure's documented OpenID Connect deployment setup with a federated identity restricted to:

```
repo:brunnojob/devrescue:environment:azure-api
```

Grant only the deployment access needed for the existing App Service. In GitHub repository settings create/select environment `azure-api` and configure these non-secret variables (repository variables are also supported):

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_WEBAPP_NAME`
- `DEVRESCUE_API_URL` — the independent HTTPS API base URL, without `/api`.

Set `DEVRESCUE_API_URL` as a **repository variable** as well, so the Pages workflow can read it. None of these variables contains a database password or OAuth client secret. The deployment workflow builds the API and installs only `pg` at runtime. Server credentials remain in Azure settings.

Run **Actions → Azure API → Run workflow** after configuring the existing app and OIDC. It is manual so missing Azure authorization cannot break normal CI or silently provision resources. Then run **GitHub Pages** again to bake the public API URL into the frontend. Pages is deployed automatically for subsequent web changes on `main`.

## 3. Verify the real integration

1. `GET ${API_ORIGIN}/health` confirms only that Node is listening.
2. `GET ${API_ORIGIN}/api/getSyncStatus` with origin `https://brunnojob.github.io` must return `db: "ready"`. This probes verified TLS and checks the existing schema.
3. From Pages create a disposable test account, sign in, link GitHub, and start the trial or verify a sponsorship. Explicitly save a reviewed derived report, refresh, read it back, and delete only that test report. Confirm another test account cannot see it. Never upload a production incident or raw secret to test sync.
4. Test sign-out, a blocked third-party-cookie browser, and an invalid OAuth completion. The app also supports a per-user bearer session held in tab-scoped `sessionStorage`; it is not a GitHub token or shared service credential. Same-origin script compromise can read this token, so do not embed untrusted scripts or unrelated apps on this Pages origin.

No secret enters `VITE_*`. Only the API base URL is public. CORS permits the configured frontend origin. POSTs require JSON, the allowed origin and, for authenticated changes, session-bound CSRF. Responses are non-cacheable. Request bodies are capped at 96 KiB; report payloads have tighter validation. API rate limits are an in-process basic guard, not a distributed abuse-protection service.

## Schema checks and deliberate migrations

Both reviewed schemas are in `apps/web/db/`. Existing compatible installations need no migration. For an explicit, reviewed installation only, run from `apps/web` with a separate private `MIGRATION_DATABASE_URL`:

Bundle a script with the installed esbuild CLI so its imports work on all supported Node versions:

```sh
npx esbuild scripts/migrate-devrescue.ts --bundle --platform=node --format=esm --packages=external --outfile=scripts/migrate-devrescue.mjs
node scripts/migrate-devrescue.mjs
# Only after reviewing the printed SQL hash and preflight:
node scripts/migrate-devrescue.mjs --apply --schema-sha256=REVIEWED_HASH
```

Repeat with `migrate-access.ts` only if access tables are absent. The scripts abort on incompatible schema and require an exact reviewed hash before applying SQL. They never run as part of the CI or deploy workflows. The synthetic verifier `scripts/verify-remote.ts` can be bundled the same way; it creates and cleans up a synthetic account/report and therefore must be run deliberately against the intended database.

References: [Azure OIDC deploy](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions?tabs=openid), [GitHub OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).
