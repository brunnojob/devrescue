# Optional Azure PostgreSQL history

The supplied server is `rg-db-wallmarket.postgres.database.azure.com`, port 5432. The screenshot does not provide a password, a connection grant or a dedicated DevRescue database. No remote connection or schema change has been made.

Use a dedicated `devrescue` database and a least-privilege runtime role rather than the Wallmarket administrator. Keep unrelated application tables isolated. Ask your Azure administrator to provision these if needed.

1. From an authorized backend host, install the optional API dependencies: `cd server && npm install`.
2. Review `schema.sql` and apply it explicitly to the dedicated database using a migration role. The runtime identity needs only schema USAGE and SELECT/INSERT/DELETE on `devrescue.reports`.
3. Copy `server/.env.example` into backend configuration. Set DATABASE_URL and an independently generated API_TOKEN of at least 32 random characters. Never commit the values.
4. Set PGSSLROOTCERT to a current trusted Azure CA bundle obtained from Microsoft's official documentation. The driver verifies the chain. Do not disable TLS verification or add `sslmode` options to the connection string that override the explicit driver TLS configuration.
5. Start with `node --env-file=.env index.js` from `server/`. Default bind is loopback. Use authenticated HTTPS behind an appropriate reverse proxy for remote clients, with request limits and rate limiting. Keep the database firewall restricted to the backend.
6. Verify `/health`, then authenticated POST/GET `/v1/reports`. POST accepts `{"log":"..."}`. Only sanitized derived evidence is stored, not complete logs. DELETE `/v1/reports/:uuid` removes an owner's report.

Every non-health endpoint requires `Authorization: Bearer <API_TOKEN>`. Never embed this service token in the public dashboard. The API is designed for one owner; a public SaaS needs real user authentication, per-user authorization, rate limiting, retention policies and credential rotation before exposure. Changing the service token changes the report owner fingerprint; migrate ownership deliberately if rotating it.

The static workbench does not call this API. Browser history remains local. This avoids pretending that a connection exists before credentials, hosting and user authentication are configured.
