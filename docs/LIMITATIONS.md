# Limits and privacy

This early release is a deterministic troubleshooting toolkit. It does not solve every development problem. It recognizes 20 rule families and reports matching evidence, not causal certainty or calibrated statistical confidence.

- Maximum log size: 2 MiB; maximum finding groups: 200. Repeated signatures at the same location are grouped. Distinct messages in one group can share a rule; review the original log locally.
- The analyzer accepts decoded UTF-8 text, not ZIP workflow archives. It does not download GitHub job logs automatically.
- A traceback location comes from the last observed frame, which may be a dependency rather than the original source of the failure.
- Comparisons match rule/file/line. Line shifts can look like new findings; absent signatures do not prove a repair.
- Redaction handles common credential formats and named secret assignments. It cannot recognize every secret, personal identifier or custom format. Review sanitized output before upload or sharing.
- Browser analysis has no network dependency after assets load. Hosting receives normal HTTP requests for assets. The workbench performs no telemetry or log uploads.
- Browser history is opt-in, same-browser localStorage, limited to ten derived reports; full logs are not retained. Local storage is accessible to other code on the same origin. Do not enable it for sensitive incidents on shared devices.
- `doctor` reads environment variable names, not secret values in its output. File scanning skips symlinks, hidden paths, dependencies and generated directories. Scope: 500 files, depth 5, 256 KiB per source file.
- Automatic fixes are deliberately restricted. In v0.1, only an explicit `.env` ignore entry can be added. Backup, content validation and stale-file checks are required. Already tracked `.env` files still need manual removal from tracking and credential rotation when appropriate.
- Suggested commands are never run automatically. Dependencies may execute install scripts when you install them yourself.
- Azure persistence is optional and requires backend secrets, schema provisioning and network access. It has not been connected to the user's Azure server. The bundled API is a single-owner service token prototype, not a multi-tenant hosted SaaS.
- No guarantee of time saved, revenue, sponsor conversion, availability or a support SLA.

The core and hosted Lovable prototype currently use separate deterministic engines. The repository workbench shares its engine with the CLI and Action and is the canonical implementation.
