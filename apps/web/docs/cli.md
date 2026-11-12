# DevRescue CLI and GitHub Action

The CLI runs locally with Node.js 22. It does not connect to a service, upload
logs, or execute suggested commands. It shares the workbench's deterministic
signature analyzer; unrecognized errors may produce no findings.

```sh
node bin/devrescue.js analyze ./ci.log --markdown
node bin/devrescue.js analyze ./ci.log --json
node bin/devrescue.js analyze ./ci.log --markdown --fail-on-findings
```

Input must be a regular UTF-8 file no larger than 2 MiB (2,097,152 bytes).
Reports include grouped findings, available locations, redacted evidence,
probable causes, suggested commands, and warnings. They exclude the full log.
Redaction is pattern-based, not a guarantee that every possible secret is found;
review reports before sharing them.

Exit codes:

- `0`: analysis completed (including findings, unless fail mode is enabled).
- `1`: at least one supported finding with `--fail-on-findings`.
- `2`: invalid arguments, invalid encoding, oversized input, or a read error.

## Use in a workflow

After releasing a tag containing the root `action.yml`, `bin/devrescue.js`,
and `bin/analyzer.cjs`:

```yaml
- uses: actions/checkout@v4
- name: Diagnose an existing CI log
  if: always()
  uses: brunnojob/devrescue@v1
  with:
    log-path: ./ci.log
    fail-on-findings: "false"
```

The preceding workflow steps must create `ci.log`; this action does not capture
other steps' logs automatically. The sanitized Markdown report is printed and
appended to the GitHub job summary. Workflow commands are disabled while
printing untrusted evidence.

## Prepare a release

```sh
bun install --frozen-lockfile
bun run cli:compile
bunx vitest run src/lib/analyzer.test.ts src/lib/cli.test.ts
node bin/devrescue.js --help
```

Commit the generated `bin/analyzer.cjs` alongside the CLI and `action.yml` in
the repository root before creating a release. Compilation is a maintainer
step; action consumers do not need Bun, TypeScript, or an installation step.
The CLI tests compare the shipped analyzer to its source to detect stale releases.
