# Contributing

Open an issue with a minimal sanitized log, expected finding and actual output. For a new rule, add a positive fixture and a plausible false-positive fixture, then run `npm test`. Keep the core dependency-free and deterministic. Never execute log content or manufacture source patches without validated context. The root CLI/Action and the browser analyzer currently have separate engines; add fixtures to the implementation you change and describe any behavior difference. Run the checks listed in AGENTS.md.

Please do not include credentials, personal data or proprietary logs. Report security problems privately as described in SECURITY.md.

