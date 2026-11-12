# Security

Report vulnerabilities privately using GitHub's private vulnerability reporting for this repository. Never include real credentials or incident logs in public issues.

The analyzer executes no log content or suggested commands. Redaction is heuristic: review reports before sharing. Cloud uploads are explicit and contain derived reports, not full logs.

The native API validates payloads and origin, uses per-user hashed sessions and CSRF, and scopes SQL operations by user. New passwords use salted PBKDF2-SHA256 with 600,000 iterations; existing hashes retain their encoded iteration count. Direct GitHub OAuth uses state, PKCE and one-use pending records; GitHub tokens are AES-256-GCM encrypted at rest. Infrastructure secrets stay on Azure. Preserve the existing encryption key during migration.

Pages and API use separate origins. HttpOnly secure cross-site cookies are supported, with a tab-scoped per-user bearer session fallback for browsers blocking third-party cookies. This token is accessible to same-origin scripts; do not embed untrusted scripts or unrelated applications on the same origin. It is not an infrastructure or OAuth token.

TLS certificate verification is mandatory for the existing Azure PostgreSQL host. Do not commit secrets, weaken network controls, or apply SQL migrations automatically. Follow [the Azure guide](docs/AZURE.md) for deployment and live verification. Local and CI tests use synthetic databases; they do not establish production connectivity.
