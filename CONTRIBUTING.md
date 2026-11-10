# Contributing

Open an issue with a minimal sanitized log, expected finding and actual output. For a new rule, add a positive fixture and a plausible false-positive fixture, then run `npm test`. Keep the core dependency-free and deterministic. Never execute log content or manufacture source patches without validated context. Browser and CLI behavior should share `src/engine.js`.

Please do not include credentials, personal data or proprietary logs. Report security problems privately using the contact in SECURITY.md.
