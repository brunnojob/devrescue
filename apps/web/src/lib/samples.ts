export const SAMPLES: Record<string, string> = {
  "Node / TypeScript build": `\x1b[31m> app@1.0.0 build\x1b[0m
src/api/client.ts(42,7): error TS2322: Type 'string' is not assignable to type 'number'.
src/api/client.ts(42,7): error TS2322: Type 'string' is not assignable to type 'number'.
src/routes/home.tsx:12:3 - error TS2304: Cannot find name 'useStat'.
npm error Missing script: "biuld"
Error: listen EADDRINUSE: address already in use :::3000
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz0123456789`,
  "npm install conflict": `npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
npm ERR! peer react@"^17.0.0" from some-lib@2.1.0
npm ERR! network request to https://registry.npmjs.org failed, reason: ETIMEDOUT
npm ERR! code ENOSPC: no space left on device, write`,
  "Python service": `Traceback (most recent call last):
  File "/app/main.py", line 3, in <module>
    import requests
ModuleNotFoundError: No module named 'requests'
psycopg2.OperationalError: connection to server at "db.internal" (10.0.0.5), port 5432 failed: password authentication failed for user "app"
DATABASE_URL=postgres://app:SuperSecret123@db.internal:5432/app`,
  "Docker / Git / network": `permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock
CONFLICT (content): Merge conflict in src/config.ts
Automatic merge failed; fix conflicts and then commit the result.
curl: (6) Could not resolve host: api.example.dev
SSL certificate problem: self-signed certificate in certificate chain
FAIL src/utils/date.test.ts
Tests:       2 failed, 14 passed, 16 total`,
};
