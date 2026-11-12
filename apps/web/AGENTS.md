# DevRescue engineering rules

- GitHub Pages hosts only the static frontend. The Node API runs on Azure and connects to the existing PostgreSQL server using server-only settings and verified TLS.
- Never expose database credentials, OAuth client secrets, encryption keys or shared service tokens in frontend builds.
- Keep log analysis and diagnosis pure and offline. No log content is executed.
- Preserve the installed schema. Run existing migration scripts deliberately after review; do not automatically change or drop remote tables.
- GitHub identity, sponsorship and trial decisions are verified by the API. Client clocks are presentation only.
- Eight themes and PT/EN preferences share one provider. Never translate log evidence or commands.
- Run lint, typecheck, tests, frontend build and API build before merging.
