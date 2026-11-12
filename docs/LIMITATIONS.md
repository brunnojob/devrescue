# Limits and privacy

DevRescue is a deterministic troubleshooting toolkit. Signatures provide evidence and suggestions, not causal certainty, calibrated probability, or a guaranteed repair.

- Logs are bounded to 2 MiB. A traceback may point into a dependency. Comparisons can treat shifted line numbers as new findings.
- Redaction cannot recognize every secret or personal identifier. Review output before sharing or explicitly syncing it. No automatic log upload, model request or command execution occurs.
- Browser history is opt-in localStorage; a browser and any other script sharing its origin can read it. Avoid storing sensitive incidents on shared devices.
- The native hosted interface uses the account API for access, direct GitHub identity, trial and sponsor checks. The API must be configured separately from Pages. The MIT source and dependency-free root CLI remain usable locally without a hosted account.
- Per-user cloud report operations enforce account, CSRF and access checks server-side. The hosted interface's client access screen alone is not a security boundary.
- Cross-site cookies are HttpOnly/Secure/SameSite=None. To support browsers blocking those cookies, a per-user session bearer credential is also held in tab-scoped sessionStorage. Same-origin scripts can read it. GitHub OAuth tokens, database credentials and shared secrets never enter the frontend bundle.
- Local analysis has no network dependency after the app loads. Account/sponsor functions call the configured Azure API and the API calls GitHub. Normal hosting asset requests still occur.
- Root `doctor` scans a bounded set of repository files and outputs environment variable names, not their values. Automatic changes are narrowly restricted to an explicitly requested `.env` ignore entry, with validation and backup. Other fixes are suggestions for review.
- The root CLI/Action and newer browser analyzer currently use separate signature engines and can produce different findings. The compiled browser companion is tested separately.
- Azure schemas and host are preserved. This migration does not verify production credentials/network access, apply remote SQL, create a hosting plan, or guarantee GitHub/Azure entitlements.
- Basic in-process rate limiting is not a distributed abuse-prevention system. PostgreSQL connections are bounded by per-request timeouts; size the existing runtime/database for expected traffic.
- There is no revenue, time-saved, uptime or support-SLA guarantee.
