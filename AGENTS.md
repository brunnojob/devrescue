# DevRescue

The root contains the dependency-free Node CLI and composite GitHub Action. `apps/web` contains the native Vite frontend and Node API. Deploy the frontend with GitHub Pages and the API to the existing Azure runtime. Preserve the PostgreSQL host and both reviewed schemas.

Never put credentials in frontend variables or commits. No automatic database migrations. Keep raw logs local; remote sync must be explicit and limited to sanitized derived reports. Keep PT/EN and all eight themes.

Before merging, run root `npm test`, `npm run demo`, and `npm pack --dry-run`; in `apps/web`, run `npm ci`, `npm test`, `npm run lint`, `npm run build`, `npm run typecheck`, and `npm run api:build`. Keep the Action compatible with Bash 3.2 and Node 22/24 on all three operating systems.
