// Deterministic, client-side log analyzer. Never executes anything.
export type Severity = "critical" | "error" | "warning";
export type Category =
  "typescript" | "python" | "npm" | "system" | "docker" | "database" | "git" | "network" | "tests";
export interface Finding {
  id: string;
  ruleId: string;
  title: string;
  category: Category;
  severity: Severity;
  confidence: number;
  evidence: string[];
  location?: string | undefined;
  occurrences: number;
  explanation: string;
  commands: string[];
  warnings: string[];
}
export interface AnalysisResult {
  sanitized: string;
  redactions: number;
  findings: Finding[];
  lineCount: number;
}

// eslint-disable-next-line no-control-regex -- ESC is the control char that defines an ANSI sequence
const ANSI = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
export function stripAnsi(s: string) {
  return s.replace(ANSI, "");
}

const REDACTORS: [RegExp, string | ((...a: string[]) => string)][] = [
  [/\b([a-z][a-z0-9+.-]*:\/\/)([^:/\s@]+):([^@\s/]+)@/gi, (_m, p, u) => `${p}${u}:[REDACTED]@`],
  [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    "[REDACTED_PRIVATE_KEY]",
  ],
  [/\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[REDACTED_GITHUB_TOKEN]"],
  [
    /\b(sk-[A-Za-z0-9_-]{16,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|npm_[A-Za-z0-9]{30,})\b/g,
    "[REDACTED_TOKEN]",
  ],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_JWT]"],
  [/(authorization:\s*(?:bearer|basic)\s+)\S+/gi, "$1[REDACTED]"],
  [
    /\b((?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret)\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/gi,
    "$1[REDACTED]",
  ],
];
export function redact(s: string): { text: string; count: number } {
  let count = 0,
    text = s;
  for (const [re, rep] of REDACTORS)
    text = text.replace(re, (...args: string[]) => {
      count++;
      return typeof rep === "string"
        ? (args[0] ?? "").replace(new RegExp(re.source, re.flags.replace("g", "")), rep)
        : rep(...args);
    });
  return { text, count };
}

interface Rule {
  id: string;
  title: string;
  category: Category;
  severity: Severity;
  confidence: number;
  pattern: RegExp;
  explanation: string;
  commands: string[];
  warnings?: string[];
  location?: (m: RegExpMatchArray) => string | undefined;
  supersedes?: string[]; // cascades: if this matches, drop these
  key?: (m: RegExpMatchArray) => string | undefined; // dedupe key per rule
}
const RULES: Rule[] = [
  {
    id: "ts-diagnostic",
    title: "TypeScript compile error",
    category: "typescript",
    severity: "error",
    confidence: 0.95,
    pattern: /([\w./\\-]+\.(?:tsx?|mts|cts))[(:](\d+)[,:](\d+)\)?:?\s*-?\s*error\s+(TS\d+):\s*(.+)/,
    location: (m) => `${m[1]}:${m[2]}:${m[3]}`,
    key: (m) => `${m[1]}:${m[2]}:${m[4]}`,
    explanation:
      "The TypeScript compiler reported a type or syntax error at a specific file and line.",
    commands: ["npx tsc --noEmit --pretty", "npx tsc --noEmit --listFiles | head"],
    warnings: ["Avoid silencing with `any` or `@ts-ignore`; fix the underlying type."],
  },
  {
    id: "py-missing-module",
    title: "Python module not found",
    category: "python",
    severity: "error",
    confidence: 0.95,
    pattern: /ModuleNotFoundError: No module named ['"]([\w.]+)['"]/,
    key: (m) => m[1],
    location: (m) => `module ${m[1]}`,
    supersedes: ["py-traceback"],
    explanation:
      "Python could not import a module. It is likely not installed in the active interpreter/virtualenv.",
    commands: [
      "python -m pip --version",
      "python -m pip install <package>",
      'python -c "import sys; print(sys.executable)"',
    ],
    warnings: [
      "The import name may differ from the PyPI package name (e.g. cv2 → opencv-python). Verify before installing.",
    ],
  },
  {
    id: "py-traceback",
    title: "Python exception traceback",
    category: "python",
    severity: "error",
    confidence: 0.8,
    pattern: /File "([^"]+)", line (\d+)/,
    location: (m) => `${m[1]}:${m[2]}`,
    key: () => "tb",
    explanation:
      "A Python exception was raised. The last frame in the traceback is usually closest to the cause.",
    commands: ["python -X dev <script.py>", "python -m pdb <script.py>"],
  },
  {
    id: "npm-eresolve",
    title: "npm peer dependency conflict (ERESOLVE)",
    category: "npm",
    severity: "error",
    confidence: 0.95,
    pattern: /npm (?:ERR!|error) (?:code )?ERESOLVE/,
    key: () => "x",
    explanation: "npm could not resolve a dependency tree because peer dependency ranges conflict.",
    commands: ["npm ls <package>", "npm explain <package>", "npm install --legacy-peer-deps"],
    warnings: [
      "--legacy-peer-deps / --force may install incompatible versions. Prefer aligning versions first.",
    ],
  },
  {
    id: "npm-missing-script",
    title: "npm script not found",
    category: "npm",
    severity: "error",
    confidence: 0.95,
    pattern: /(?:Missing script:\s*"?([\w:-]+)"?|error: script "?([\w:-]+)"? not found)/i,
    key: (m) => m[1] || m[2],
    location: (m) => `package.json scripts.${m[1] || m[2]}`,
    explanation: "The requested script is not defined in package.json in the current directory.",
    commands: ["npm run", "cat package.json", "pwd"],
  },
  {
    id: "enospc",
    title: "No space left / file watcher limit (ENOSPC)",
    category: "system",
    severity: "critical",
    confidence: 0.9,
    pattern: /ENOSPC|No space left on device|System limit for number of file watchers reached/i,
    key: () => "x",
    explanation:
      "Either the disk is full or (on Linux) the inotify file watcher limit was reached.",
    commands: [
      "df -h",
      "du -sh node_modules .next dist 2>/dev/null",
      "cat /proc/sys/fs/inotify/max_user_watches",
    ],
    warnings: [
      "Review before deleting files; raising inotify limits requires sudo and persists system-wide.",
    ],
  },
  {
    id: "eaddrinuse",
    title: "Port already in use (EADDRINUSE)",
    category: "system",
    severity: "error",
    confidence: 0.95,
    pattern: /EADDRINUSE[^\n]*?(?::(\d{2,5}))?|address already in use[^\n]*?(?::(\d{2,5}))?/i,
    key: (m) => m[1] || m[2] || "x",
    location: (m) => (m[1] || m[2] ? `port ${m[1] || m[2]}` : undefined),
    explanation: "Another process is already listening on the port this app wants.",
    commands: ["lsof -i :<port>", "netstat -ano | findstr :<port>   # Windows"],
    warnings: ["Confirm which process owns the port before stopping it."],
  },
  {
    id: "oom",
    title: "Out of memory",
    category: "system",
    severity: "critical",
    confidence: 0.9,
    pattern:
      /JavaScript heap out of memory|FATAL ERROR: .*Allocation failed|OOMKilled|Killed process \d+|MemoryError|exit code 137/i,
    key: () => "x",
    explanation:
      "The process exceeded available memory (Node heap limit, container limit, or system OOM killer).",
    commands: [
      "free -h",
      "NODE_OPTIONS=--max-old-space-size=4096 npm run build",
      "docker stats --no-stream",
    ],
    warnings: ["Raising memory limits can hide leaks; check for unbounded growth."],
  },
  {
    id: "docker-daemon",
    title: "Docker daemon not reachable",
    category: "docker",
    severity: "error",
    confidence: 0.95,
    pattern:
      /Cannot connect to the Docker daemon|error during connect:.*docker|Is the docker daemon running/i,
    key: () => "x",
    explanation:
      "The Docker CLI cannot reach the daemon. It may be stopped or the context/socket is wrong.",
    commands: ["docker context ls", "docker info", "systemctl status docker"],
  },
  {
    id: "docker-permission",
    title: "Docker socket permission denied",
    category: "docker",
    severity: "error",
    confidence: 0.9,
    pattern: /permission denied while trying to connect to the Docker daemon socket/i,
    key: () => "x",
    supersedes: ["docker-daemon"],
    explanation: "Your user lacks permission on /var/run/docker.sock.",
    commands: ["ls -l /var/run/docker.sock", "groups", "sudo usermod -aG docker $USER"],
    warnings: ["Docker group membership is root-equivalent. Log out/in after changing groups."],
  },
  {
    id: "pg-connection",
    title: "PostgreSQL connection failed",
    category: "database",
    severity: "error",
    confidence: 0.9,
    pattern:
      /(?:ECONNREFUSED[^\n]*:5432|could not connect to server|connection to server at .* failed|password authentication failed for user|FATAL:\s+(?:database "[^"]+" does not exist|no pg_hba\.conf entry))/i,
    key: () => "x",
    explanation:
      "The client could not connect or authenticate to PostgreSQL (server down, wrong host/port, credentials, or pg_hba/firewall rules).",
    commands: ["pg_isready -h <host> -p 5432", "psql \"$DATABASE_URL\" -c 'select 1'"],
    warnings: [
      "Never paste real connection strings in shared logs; rotate any credential that leaked.",
    ],
  },
  {
    id: "pg-migration",
    title: "Database migration error",
    category: "database",
    severity: "error",
    confidence: 0.8,
    pattern:
      /(?:migration[^\n]*(?:failed|error)|relation "[^"]+" (?:already exists|does not exist)|column "[^"]+" (?:of relation "[^"]+" )?does not exist)/i,
    key: () => "x",
    explanation:
      "A schema migration failed or the schema is out of sync with what the code expects.",
    commands: ["<tool> migrate status", "psql \"$DATABASE_URL\" -c '\\dt'"],
    warnings: ["Back up before re-running or rolling back migrations on shared databases."],
  },
  {
    id: "git-conflict",
    title: "Git merge conflict",
    category: "git",
    severity: "error",
    confidence: 0.95,
    pattern: /CONFLICT \([^)]+\): Merge conflict in (\S+)|^<{7} \S+/m,
    key: (m) => m[1] || "markers",
    location: (m) => m[1],
    explanation: "Git could not auto-merge; conflicting changes must be resolved manually.",
    commands: [
      "git status",
      "git diff --name-only --diff-filter=U",
      "git merge --abort   # to cancel",
    ],
    warnings: ["Aborting a merge discards the in-progress merge state."],
  },
  {
    id: "dns",
    title: "DNS resolution failure",
    category: "network",
    severity: "error",
    confidence: 0.9,
    pattern:
      /(?:\bENOTFOUND\b|\bEAI_AGAIN\b|getaddrinfo\s+\w+|Could not resolve host:?)\s*([\w.-]+\.[a-z]{2,})?/i,
    key: (m) => m[1] || "x",
    location: (m) => m[1],
    explanation:
      "A hostname could not be resolved. Check network, VPN, proxy, or typos in the host.",
    commands: ["nslookup <host>", "curl -v https://<host>"],
  },
  {
    id: "tls",
    title: "TLS / certificate error",
    category: "network",
    severity: "error",
    confidence: 0.85,
    pattern:
      /(?:UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT_IN_CHAIN|CERT_HAS_EXPIRED|certificate verify failed|SSL certificate problem|ERR_TLS_CERT_ALTNAME_INVALID)/i,
    key: () => "x",
    explanation:
      "The TLS certificate chain could not be verified (corporate proxy, self-signed, expired, or hostname mismatch).",
    commands: ["openssl s_client -connect <host>:443 -servername <host>", "npm config get cafile"],
    warnings: [
      "Do not disable verification (NODE_TLS_REJECT_UNAUTHORIZED=0, strict-ssl=false) permanently.",
    ],
  },
  {
    id: "network-timeout",
    title: "Network connection refused / timeout",
    category: "network",
    severity: "warning",
    confidence: 0.7,
    pattern: /ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket hang up/i,
    key: () => "x",
    supersedes: [],
    explanation: "A network connection was refused, reset, or timed out.",
    commands: ["curl -v <url>", "env | grep -i proxy"],
  },
  {
    id: "tests-failed",
    title: "Test failures",
    category: "tests",
    severity: "error",
    confidence: 0.85,
    pattern:
      /(?:Tests?:\s+(\d+) failed|(\d+) failed[,\s]|FAIL\s+(\S+\.(?:test|spec)\.\w+)|=+ (\d+) failed|AssertionError)/,
    key: (m) => m[3] || "summary",
    location: (m) => m[3],
    explanation: "One or more automated tests failed. Inspect the first failing assertion.",
    commands: ["npx vitest run <file>", "npx jest <file> --verbose", "pytest -x -vv"],
  },
];

const MAX_EVIDENCE = 3;
export function analyze(raw: string): AnalysisResult {
  const { text: sanitized, count: redactions } = redact(stripAnsi(raw).replace(/\r\n?/g, "\n"));
  const lines = sanitized.split("\n");
  const map = new Map<string, Finding>();
  lines.forEach((line, i) => {
    for (const r of RULES) {
      const m = line.match(r.pattern);
      if (!m) continue;
      const k = `${r.id}|${r.key ? r.key(m) : line.trim()}`;
      const ev = `L${i + 1}: ${line.trim().slice(0, 300)}`;
      const ex = map.get(k);
      if (ex) {
        ex.occurrences++;
        if (ex.evidence.length < MAX_EVIDENCE) ex.evidence.push(ev);
        continue;
      }
      map.set(k, {
        id: k,
        ruleId: r.id,
        title: r.title,
        category: r.category,
        severity: r.severity,
        confidence: r.confidence,
        evidence: [ev],
        location: r.location?.(m),
        occurrences: 1,
        explanation: r.explanation,
        commands: r.commands,
        warnings: r.warnings ?? [],
      });
    }
  });
  let findings = [...map.values()];
  const present = new Set(findings.map((f) => f.ruleId));
  const dropped = new Set<string>();
  for (const r of RULES) if (present.has(r.id)) r.supersedes?.forEach((s) => dropped.add(s));
  // Specific network/db errors make the generic connection one a cascade.
  if (present.has("pg-connection") || present.has("dns") || present.has("tls"))
    dropped.add("network-timeout");
  if (present.has("npm-eresolve")) dropped.add("network-timeout");
  findings = findings.filter((f) => !dropped.has(f.ruleId));
  const sev = { critical: 0, error: 1, warning: 2 };
  findings.sort((a, b) => sev[a.severity] - sev[b.severity] || b.confidence - a.confidence);
  return { sanitized, redactions, findings, lineCount: lines.length };
}

export function compareLogs(before: string, after: string) {
  const a = analyze(before).findings,
    b = analyze(after).findings;
  const ka = new Set(a.map((f) => f.id)),
    kb = new Set(b.map((f) => f.id));
  return {
    introduced: b.filter((f) => !ka.has(f.id)),
    resolved: a.filter((f) => !kb.has(f.id)),
    persisting: b.filter((f) => ka.has(f.id)),
  };
}

export function toJSON(r: AnalysisResult) {
  return JSON.stringify(
    {
      tool: "DevRescue",
      version: 1,
      generatedAt: new Date().toISOString(),
      redactions: r.redactions,
      lineCount: r.lineCount,
      findings: r.findings,
    },
    null,
    2,
  );
}
export function toMarkdown(r: AnalysisResult) {
  const out = [
    `# DevRescue report`,
    ``,
    `- Lines analyzed: ${r.lineCount}`,
    `- Redactions applied: ${r.redactions}`,
    `- Findings: ${r.findings.length}`,
    ``,
    `> Deterministic pattern-based suggestions. Review every command before running it.`,
    ``,
  ];
  for (const f of r.findings) {
    out.push(
      `## ${f.title} (${f.severity}, ${Math.round(f.confidence * 100)}% confidence)`,
      ``,
      f.explanation,
      ``,
    );
    if (f.location) out.push(`**Location:** \`${f.location}\``, ``);
    out.push(
      `**Evidence** (${f.occurrences}x):`,
      "```",
      ...f.evidence,
      "```",
      ``,
      `**Suggested commands:**`,
      "```sh",
      ...f.commands,
      "```",
      ``,
    );
    if (f.warnings.length) out.push(...f.warnings.map((w) => `> ⚠ ${w}`), ``);
  }
  return out.join("\n");
}
