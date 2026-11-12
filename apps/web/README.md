# DevRescue web and API

Native React/Vite application for GitHub Pages, with a separate Node.js 22 API for Azure and the existing Azure PostgreSQL database. No external app builder or gateway is required.

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
npm run typecheck
npm run api:build
npm run api:start
```

Open the workbench at `/devrescue/`. Hash routes work on GitHub Pages without rewrite rules. Eight appearance themes and English/Portuguese preferences are stored locally.

Set the public `VITE_API_BASE_URL` before building (see `.env.example`). It must point at the HTTPS API, never at PostgreSQL. The GitHub Pages workflow reads this from the repository variable `DEVRESCUE_API_URL`. Without a configured API, account features show an explicit setup message.

The API accepts only `PUBLIC_SITE_URL`'s origin, validates payloads, binds CSRF to per-user sessions, and keeps GitHub OAuth credentials and database secrets server-side. Direct GitHub OAuth uses state, a one-use pending record and PKCE. See the repository's [Azure deployment guide](../../docs/AZURE.md) for exact configuration, migration and verification steps.

Existing database schemas are retained in `db/`. No schema migration is run by a deployment. Do not apply migrations to unrelated databases or commit secrets.
