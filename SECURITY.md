# Security

Report vulnerabilities privately to contato@brunnodev.store. Include reproduction steps with synthetic data; never send live credentials. There is no guaranteed response SLA.

Redaction is best effort. Do not upload real secrets to issues, CI artifacts, public dashboards or support reports. Automatic patches never execute suggested shell commands. Optional server access must remain behind authenticated HTTPS; the supplied service token API is not a multi-tenant SaaS.

The per-user full-stack application in `apps/web` stores session token hashes, uses httpOnly Secure SameSite cookies and session-bound CSRF validation, and verifies Azure PostgreSQL TLS. Real Azure connectivity remains unverified. Keep migration credentials separate from the runtime identity. Do not expose the legacy `server/` service token through browser code. Review egress, rate limiting, account abuse controls and backup/retention before a public production launch.
