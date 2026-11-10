# Azure PostgreSQL account sync

The full-stack application lives in [`apps/web`](../apps/web). Its server targets `rg-db-wallmarket.postgres.database.azure.com:5432`; browser code never receives database credentials. It implements per-user accounts, sessions, CSRF checks and report CRUD. Uploads require an explicit action after reviewing a derived sanitized summary. Raw/full logs are never synced.

## Current status — 2026-11-10

Backend code, type checking, lint and production build passed in Lovable; 29 tests passed, including SQL behavior against PGlite. A live Azure SELECT 1 and synthetic report CRUD have **not** passed. The development connection attempt timed out. This alone does not distinguish Azure firewall, private networking, DNS or outbound runtime restrictions. No remote schema was applied.

## Server secrets

In the Lovable project menu open Settings → Secrets. Never enter credentials in chat or commit them.

- `DATABASE_URL`: runtime PostgreSQL connection URL with a least-privilege login and the correct database.
- `MIGRATION_DATABASE_URL`: separate migration login, needed only for the deliberate schema setup script.
- `PGSSLROOTCERT_PEM`: optional trusted CA certificate text for Node execution. TLS certificate verification is always enabled; URL options cannot disable it.

Use the actual database name. If a password contains URL-reserved characters, percent-encode its username/password components. Do not use `VITE_*` for any secret. The app rejects other database hosts.

## Reviewed schema and deliberate application

Read [`apps/web/db/devrescue-schema.sql`](../apps/web/db/devrescue-schema.sql). It creates only `devrescue.users`, `devrescue.sessions`, `devrescue.reports` and their indexes. No unrelated Wallmarket tables are touched. Existing incompatible layouts cause an abort; the scripts never drop or alter existing data. In particular the older `server/schema.sql` uses `owner_id` and must not be applied for the full-stack app.

From `apps/web`, with secrets supplied privately by the backend environment:

```sh
bun scripts/migrate-devrescue.ts
# Review the printed schema hash and preflight before applying:
bun scripts/migrate-devrescue.ts --apply --schema-sha256=REVIEWED_HASH
bun scripts/verify-remote.ts
```

The verifier must pass SELECT 1 and synthetic create/read/delete before calling the integration connected. It cleans up its synthetic account and report.

## Hosting and network

GitHub Pages serves the original offline UI; it cannot run these server functions. Use the full-stack Lovable application or an appropriate server host. Confirm database reachability from the actual deployed runtime, not just a developer workstation. Restrict Azure network access to the intended backend egress/private network; do not open all addresses as a workaround. The status probe is cached per running server copy, not a complete distributed rate limiter. Production public exposure requires appropriate abuse controls.

## Legacy API

The root `server/` folder is the original single-owner service-token prototype. It is independent of the per-user application and its table layout differs. Existing users should review/migrate data deliberately rather than running both initial schemas against the same schema namespace.
