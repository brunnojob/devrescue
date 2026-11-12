// Deterministic rules: evidence is observable; causes remain hypotheses.
export const MAX_BYTES = 2 * 1024 * 1024;
export function sanitize(value) {
  return String(value).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"'<>]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|AKIA[A-Z0-9]{16}|sk_(?:live|test)_[A-Za-z0-9]+)\b/g, '[REDACTED_TOKEN]')
    .replace(/((?:password|passwd|pwd|secret|token|api[_-]?key|authorization)\s*["']?\s*[:=]\s*)[^\r\n]+/gi, '$1[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g, '[REDACTED_PRIVATE_KEY]');
}
const rule = (id, pattern, title, cause, steps, category = 'environment') => ({id, pattern, title, cause, steps, category});
export const rules = [
  rule('npm-peer', /ERESOLVE|unable to resolve dependency tree/i, 'Dependency versions conflict', 'The package manager could not satisfy the dependency graph. Inspect peer ranges before changing versions.', ['npm explain <package>', 'npm ls --all', 'Align the conflicting versions in package.json; regenerate the lockfile and run tests.'], 'dependencies'),
  rule('npm-lock', /npm ci.*(?:lock|sync)|package.json and package-lock.json.*sync|EUSAGE.*npm ci/i, 'Lockfile and manifest disagree', 'npm ci requires a synchronized package-lock.json.', ['Run npm install with the project Node/npm versions, review both manifest and lockfile diffs, then npm ci.'], 'dependencies'),
  rule('npm-script', /Missing script:/i, 'Requested npm script is absent', 'The requested script is not defined in this package.', ['npm run', 'Check the working directory and define or select the intended script.'], 'dependencies'),
  rule('js-module', /Cannot find module|ERR_MODULE_NOT_FOUND|Module not found.*(?:resolve|find)/i, 'Module cannot be resolved', 'A dependency, path, filename case or build output may be missing.', ['Check the exact import and filename case.', 'Restore dependencies using the committed lockfile and correct package manager.'], 'dependencies'),
  rule('python-module', /ModuleNotFoundError: No module named/i, 'Python module is unavailable', 'The active interpreter cannot import this module. Import names can differ from distribution names.', ['python -m pip --version', 'Activate the project virtual environment, then install its declared requirements.'], 'dependencies'),
  rule('python-import', /ImportError: cannot import name/i, 'Python import is incompatible', 'Possible circular import, renamed symbol or incompatible installed version.', ['Inspect the importing file and installed version.', 'Compare declared requirements with the environment.'], 'dependencies'),
  rule('typescript', /error TS\d+:/, 'TypeScript compilation failed', 'The compiler diagnostic identifies the constraint that failed.', ['npx tsc --noEmit', 'Use the diagnostic and source location to update the type or implementation; rerun tests.'], 'build'),
  rule('port', /EADDRINUSE|address already in use/i, 'Port is already occupied', 'Another process is listening on the requested address.', ['Find the port owner using your OS process tools.', 'Stop the known process or choose an unused port; do not kill arbitrary processes.']),
  rule('disk', /ENOSPC|no space left on device/i, 'Disk space or watcher limit exhausted', 'ENOSPC can mean disk capacity, inodes, or a file watcher quota.', ['df -h', 'df -i', 'Check watcher limits and generated files before deleting anything.']),
  rule('memory', /heap out of memory|JavaScript heap out of memory|OOMKilled|out of memory|exit code 137/i, 'Process exceeded available memory', 'Memory pressure or an OOM kill may have terminated the process.', ['Inspect runner/container memory limits and peak usage.', 'Reduce build concurrency before increasing the memory limit.']),
  rule('permission', /EACCES|permission denied/i, 'Access was denied', 'The process lacks access to a path or socket.', ['Check the reported path, owner and current user.', 'Fix the specific permission; avoid sudo installs and chmod 777.']),
  rule('docker', /Cannot connect to the Docker daemon|docker daemon is not running/i, 'Docker daemon is unavailable', 'Docker is stopped or the configured context/socket is wrong.', ['docker context show', 'docker info', 'Start Docker and check the selected context.'], 'containers'),
  rule('docker-platform', /no matching manifest for|exec format error/i, 'Container architecture mismatch', 'The image or executable may target another OS/CPU.', ['docker version', 'Inspect image architecture and build for the target platform.'], 'containers'),
  rule('db-auth', /password authentication failed|SQLSTATE\W*28P01/i, 'Database authentication failed', 'The server rejected the database identity.', ['Check server-side secret configuration and username.', 'Never put database credentials in browser code or logs.'], 'database'),
  rule('db-migration', /relation .+ does not exist|SQLSTATE\W*42P01|P3009|P3018/i, 'Schema or migration state mismatch', 'The connected database may lack a required relation or have a failed migration.', ['Check the target database and migration status.', 'Back up data and review pending migrations before applying them.'], 'database'),
  rule('db-connect', /ECONNREFUSED.*5432|could not connect to server|remaining connection slots|too many clients/i, 'Database connection unavailable', 'Check database reachability, firewall, pool limits and server state.', ['Verify the server and TLS settings from the backend host.', 'Inspect pool usage and network rules without opening public access.'], 'database'),
  rule('dns', /\bENOTFOUND\b|\bEAI_AGAIN\b|Could not resolve host/i, 'DNS lookup failed', 'The host is invalid or the resolver/network is unavailable.', ['Verify the hostname and DNS from the same runner.', 'Retry only after checking transient network status.'], 'network'),
  rule('tls', /CERT_HAS_EXPIRED|SELF_SIGNED_CERT|unable to verify the first certificate/i, 'TLS certificate verification failed', 'The certificate chain, system time or trusted CA configuration is incorrect.', ['Check certificate expiry and system clock.', 'Install the correct trusted CA; keep certificate verification enabled.'], 'network'),
  rule('git-conflict', /CONFLICT \(|Merge conflict in|^<{7} /, 'Unresolved merge conflict', 'Git could not reconcile overlapping changes.', ['git status', 'Resolve conflict markers, review the combined behavior and rerun tests.'], 'git'),
  rule('test-failure', /^(?:FAIL\s|FAILED\s|AssertionError\b)|\bTests:\s+\d+ failed/, 'Test assertion failed', 'Expected and actual behavior differ; a failing test alone does not establish the root cause.', ['Run the reported test in isolation.', 'Inspect the assertion diff and recent code changes.'], 'tests'),
];
export function analyze(input) {
  if (BufferByteLength(input) > MAX_BYTES) throw new Error('Log exceeds 2 MiB; split it before analysis.');
  const clean = sanitize(input), lines = clean.split(/\r?\n/), findings = new Map();
  let pythonLocation = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const py = line.match(/File "([^"]+)", line (\d+)/);
    if (py) pythonLocation = {file: py[1], line: Number(py[2])};
    if (!line.trim()) pythonLocation = null;
    const loc = line.match(/(?:^|\s)([^\s():]+\.[A-Za-z0-9]+)(?:\((\d+),(\d+)\)|:(\d+)(?::(\d+))?)/);
    for (const r of rules) {
      if (!r.pattern.test(line)) continue;
      const location = loc ? {file: loc[1], line: Number(loc[2] || loc[4]), column: Number(loc[3] || loc[5] || 1)} : (r.id.startsWith('python-') ? pythonLocation : null);
      const key = `${r.id}:${location?.file || ''}:${location?.line || ''}`;
      const existing = findings.get(key);
      if (existing) { existing.occurrences++; continue; }
      findings.set(key, {id:r.id, category:r.category, severity:'error', title:r.title, cause:r.cause, confidence:'pattern-match', location, logLine:i+1, evidence:line.slice(0,1000), occurrences:1, steps:r.steps, automaticFix:false});
      if (findings.size >= 200) break;
    }
    if (findings.size >= 200) break;
  }
  return {schemaVersion:1, totalLines:lines.length, findings:[...findings.values()], recognized:findings.size > 0, note: findings.size ? 'Pattern matches are diagnostic leads, not proof of root cause. Review commands before use.' : 'No supported signature matched. This does not mean the build passed.', sanitizedLog:clean};
}
function BufferByteLength(value) { return new TextEncoder().encode(value).length; }
export function compare(before, after) {
  const key = f => `${f.id}:${f.location?.file || ''}:${f.location?.line || ''}`;
  const old = new Set(before.findings.map(key)), current = new Set(after.findings.map(key));
  return {added:after.findings.filter(f=>!old.has(key(f))), resolved:before.findings.filter(f=>!current.has(key(f))), recurring:after.findings.filter(f=>old.has(key(f))), note:'Resolved means absent from this log, not independently verified fixed.'};
}
export function markdown(report) {
  const safe = s => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/`/g, '').replace(/\r?\n/g, ' ');
  return ['# DevRescue report', '', report.note, '', ...report.findings.flatMap(f=>[
    `## ${safe(f.title)}`, `${f.location ? `${safe(f.location.file)}:${f.location.line} · ` : ''}Log line ${f.logLine} · ${f.occurrences} occurrence(s)`, '', `> ${safe(f.evidence)}`, '', safe(f.cause), '', ...f.steps.map(s=>`- ${safe(s)}`), ''
  ])].join('\n');
}

