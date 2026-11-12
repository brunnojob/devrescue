// Pure, deterministic enrichment of analyzer findings into an actionable plan.
// No network calls, no command execution — source files are only read as text.
import type { AnalysisResult, Finding } from "./analyzer";

export type Area = "build" | "dependencies" | "environment" | "ci" | "runtime" | "tests";

interface Playbook {
  area: Area;
  fix: string[];
  verify: string;
}

export const PLAYBOOKS: Record<string, Playbook> = {
  "ts-diagnostic": {
    area: "build",
    fix: [
      "Open the file at the reported line and fix the type or syntax error shown in the message.",
      "If a name is missing, add the import; if a type mismatches, align the value with the declared type.",
    ],
    verify: "npx tsc --noEmit",
  },
  "py-missing-module": {
    area: "dependencies",
    fix: [
      "Activate the project's virtualenv, then install the package that provides the module.",
      "Add it to requirements.txt / pyproject.toml so CI installs it too.",
    ],
    verify: 'python -c "import <module>"',
  },
  "py-traceback": {
    area: "runtime",
    fix: ["Open the last frame of the traceback (closest to the cause) and fix the failing call."],
    verify: "python <script.py>",
  },
  "npm-eresolve": {
    area: "dependencies",
    fix: [
      "Find the package whose peer range conflicts (see `npm explain`).",
      "Upgrade or pin that package to a version compatible with the peer, then reinstall.",
    ],
    verify: "npm install && npm ls",
  },
  "npm-missing-script": {
    area: "build",
    fix: [
      "Run the command from the folder that has the right package.json, or add the script to `scripts`.",
    ],
    verify: "npm run",
  },
  "node-missing-module": {
    area: "dependencies",
    fix: [
      "If it is a package: install it and add it to package.json dependencies.",
      "If it is a relative path: fix the path, file name casing or extension in the import.",
    ],
    verify: "npm ls <package> && npm run build",
  },
  enospc: {
    area: "environment",
    fix: ["Free disk space (caches, Docker images) or raise the file watcher limit."],
    verify: "df -h && cat /proc/sys/fs/inotify/max_user_watches",
  },
  eaddrinuse: {
    area: "environment",
    fix: ["Stop the process holding the port, or start the app on another port."],
    verify: "lsof -i :<port>   # should print nothing",
  },
  oom: {
    area: "environment",
    fix: [
      "Raise the memory limit for the process (e.g. NODE_OPTIONS=--max-old-space-size) or reduce the workload.",
    ],
    verify: "Re-run the same command and watch memory with `top`.",
  },
  "docker-daemon": {
    area: "environment",
    fix: ["Start Docker Desktop / the docker service, or switch to the right docker context."],
    verify: "docker info",
  },
  "docker-permission": {
    area: "environment",
    fix: ["Add your user to the docker group, then log out and back in."],
    verify: "docker ps",
  },
  "pg-connection": {
    area: "environment",
    fix: ["Start the database or correct host/port/credentials in DATABASE_URL."],
    verify: "pg_isready -h <host> -p 5432",
  },
  "pg-migration": {
    area: "build",
    fix: [
      "Apply pending migrations in order, or fix the migration that references a missing table/column.",
    ],
    verify: "<tool> migrate status",
  },
  "git-conflict": {
    area: "build",
    fix: [
      "Resolve the conflict markers in each listed file, then stage and continue the merge/rebase.",
    ],
    verify: "git diff --check && git status",
  },
  dns: {
    area: "environment",
    fix: ["Check the host name spelling and your DNS/VPN settings."],
    verify: "nslookup <host>",
  },
  tls: {
    area: "environment",
    fix: [
      "Install the missing CA (corporate proxy) via the tool's CA setting — never disable verification.",
    ],
    verify: "openssl s_client -connect <host>:443 -servername <host>",
  },
  "network-timeout": {
    area: "environment",
    fix: ["Confirm the service is up and reachable; check proxy and firewall settings."],
    verify: "curl -v <url>",
  },
  "tests-failed": {
    area: "tests",
    fix: [
      "Open the first failing assertion; fix the code or update the test if behavior changed on purpose.",
    ],
    verify: "npx vitest run <file>",
  },
  eacces: {
    area: "environment",
    fix: ["Fix ownership of the path (chown) or use a user-level npm prefix instead of sudo."],
    verify: "ls -ld <path>",
  },
  "env-missing": {
    area: "environment",
    fix: ["Set the variable in .env locally and as a secret in CI, matching .env.example."],
    verify: 'printenv | grep -c "^<NAME>="   # should print 1',
  },
  "ci-exit": {
    area: "ci",
    fix: ["Fix the first error printed before the failing step; this line is only the summary."],
    verify: "Re-run the job, or reproduce locally with the same command.",
  },
};

// root ruleId -> rule ids it commonly triggers afterwards
export const CASCADES: Record<string, string[]> = {
  "npm-eresolve": ["node-missing-module", "ts-diagnostic", "tests-failed", "ci-exit"],
  "node-missing-module": ["ts-diagnostic", "tests-failed", "ci-exit"],
  "py-missing-module": ["py-traceback", "tests-failed", "ci-exit"],
  "ts-diagnostic": ["tests-failed", "ci-exit"],
  "env-missing": ["pg-connection", "network-timeout", "tests-failed", "ci-exit"],
  "docker-daemon": ["pg-connection", "network-timeout", "tests-failed", "ci-exit"],
  "pg-connection": ["pg-migration", "tests-failed", "ci-exit"],
  dns: ["network-timeout", "npm-eresolve", "ci-exit"],
  tls: ["network-timeout", "npm-eresolve", "ci-exit"],
  enospc: ["ts-diagnostic", "tests-failed", "ci-exit"],
  oom: ["tests-failed", "ci-exit"],
  eacces: ["node-missing-module", "ci-exit"],
  "tests-failed": ["ci-exit"],
  "git-conflict": ["ts-diagnostic", "tests-failed", "ci-exit"],
};

export interface Diagnosis extends Finding {
  area: Area;
  fix: string[];
  verify: string;
  file?: string | undefined;
  line?: number | undefined;
  firstLine: number;
  snippet: string[];
  causedBy?: string; // finding id
  triggers: string[]; // finding ids
}

export interface Plan {
  diagnoses: Diagnosis[];
  roots: Diagnosis[];
  nextAction?: { finding: Diagnosis; step: string; verify: string } | undefined;
}

const lineOf = (f: Finding) => Number(/^L(\d+):/.exec(f.evidence[0] ?? "")?.[1] ?? 0);

export function parseLocation(loc?: string): {
  file?: string | undefined;
  line?: number | undefined;
} {
  const m = loc && /^(.+?\.[\w]+):(\d+)/.exec(loc);
  return m ? { file: m[1], line: Number(m[2]) } : {};
}

export function buildPlan(r: AnalysisResult, radius = 2): Plan {
  const lines = r.sanitized.split("\n");
  const ds: Diagnosis[] = r.findings.map((f) => {
    const pb = PLAYBOOKS[f.ruleId] ?? {
      area: "runtime" as Area,
      fix: [],
      verify: f.commands[0] ?? "",
    };
    const first = lineOf(f);
    const from = Math.max(1, first - radius),
      to = Math.min(lines.length, first + radius);
    const snippet: string[] = [];
    for (let n = from; first && n <= to; n++)
      snippet.push(`${n === first ? ">" : " "} ${String(n).padStart(4)} | ${lines[n - 1] ?? ""}`);
    return {
      ...f,
      ...parseLocation(f.location),
      area: pb.area,
      fix: pb.fix,
      verify: pb.verify,
      firstLine: first,
      snippet,
      triggers: [],
    };
  });
  const byFirst = [...ds].sort((a, b) => a.firstLine - b.firstLine);
  for (const d of byFirst) {
    const root = byFirst.find(
      (c) =>
        c !== d &&
        !c.causedBy &&
        c.firstLine <= d.firstLine &&
        CASCADES[c.ruleId]?.includes(d.ruleId),
    );
    if (root) {
      d.causedBy = root.id;
      root.triggers.push(d.id);
    }
  }
  const roots = ds.filter((d) => !d.causedBy);
  const top = roots[0];
  return {
    diagnoses: ds,
    roots,
    nextAction: top && { finding: top, step: top.fix[0] ?? top.explanation, verify: top.verify },
  };
}

/** Numbered excerpt of a user-provided source file around a line. */
export function sourceExcerpt(source: string, line: number, radius = 4): string[] {
  const ls = source.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  for (let n = Math.max(1, line - radius); n <= Math.min(ls.length, line + radius); n++)
    out.push(`${n === line ? ">" : " "} ${String(n).padStart(4)} | ${ls[n - 1]}`);
  return out;
}

/** Concrete, code-aware hints from the involved file (and its imports). */
export function sourceHints(
  d: Pick<Finding, "ruleId" | "evidence" | "location">,
  source: string,
): string[] {
  const ev = d.evidence.join("\n");
  const imports = [...source.matchAll(/^\s*import\s+(?:[\s\S]*?from\s+)?["']([^"']+)["']/gm)].map(
    (m) => m[1] ?? "",
  );
  const pyImports = [
    ...source.matchAll(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm),
  ].map((m) => m[1] || m[2] || "");
  const hints: string[] = [];
  const name = /Cannot find name '([^']+)'/.exec(ev)?.[1];
  if (name) {
    const declared =
      new RegExp(`\\b(?:const|let|var|function|class|type|interface|enum)\\s+${name}\\b`).test(
        source,
      ) || new RegExp(`^\\s*import[^\\n]*\\b${name}\\b`, "m").test(source);
    hints.push(
      declared
        ? `\`${name}\` appears in this file — check its scope and spelling at the reported line.`
        : `\`${name}\` is never declared or imported in this file — add \`import { ${name} } from "<module>"\` or declare it.`,
    );
  }
  const mod =
    /Cannot find module '([^']+)'/.exec(ev)?.[1] ??
    /Can't resolve '([^']+)'/.exec(ev)?.[1] ??
    /No module named '([^']+)'/.exec(ev)?.[1];
  if (mod) {
    const used =
      imports.includes(mod) || pyImports.some((p) => p === mod || p.startsWith(mod + "."));
    if (used && mod.startsWith("."))
      hints.push(`This file imports \`${mod}\` — check the path, casing and file extension exist.`);
    else if (used)
      hints.push(
        `This file imports \`${mod}\` — install it and add it to the project's dependencies.`,
      );
    else
      hints.push(
        `\`${mod}\` is not imported here; the failing import is in a dependency of this file.`,
      );
  }
  const assign = /Type '([^']+)' is not assignable to type '([^']+)'/.exec(ev);
  if (assign)
    hints.push(
      `Convert or narrow the value from \`${assign[1]}\` to \`${assign[2]}\` at the reported line, or fix the declared type.`,
    );
  if (d.ruleId === "env-missing") {
    const v = /env ([A-Z0-9_]+)/.exec(d.location ?? "")?.[1];
    if (v && source.includes(v))
      hints.push(`This file reads \`${v}\` — make sure it is defined in .env and CI secrets.`);
  }
  if (imports.length) hints.push(`Dependencies of this file: ${imports.slice(0, 8).join(", ")}.`);
  return hints;
}
