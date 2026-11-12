#!/usr/bin/env node

// Works in both CommonJS and ESM repositories. No installed runtime dependencies.
async function main() {
  const { open } = await import("node:fs/promises");
  const { TextDecoder } = await import("node:util");
  const { analyze, toJSON, toMarkdown } = await import("./analyzer.cjs");
  const args = process.argv.slice(2);
  const usage =
    "Usage: node bin/devrescue.js analyze <log-path> [--markdown | --json] [--fail-on-findings]";

  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    process.stdout.write(
      `${usage}\nExit codes: 0 success, 1 findings with --fail-on-findings, 2 invalid input or read error.\n`,
    );
    return;
  }

  const [command, file, ...flags] = args;
  if (command !== "analyze" || !file || file.startsWith("--")) {
    throw new Error(usage);
  }
  const allowed = new Set(["--markdown", "--json", "--fail-on-findings"]);
  if (flags.some((flag) => !allowed.has(flag)) || new Set(flags).size !== flags.length) {
    throw new Error("Unknown or duplicate option. " + usage);
  }
  if (flags.includes("--markdown") && flags.includes("--json")) {
    throw new Error("Choose either --markdown or --json, not both.");
  }

  const maxBytes = 2 * 1024 * 1024;
  const handle = await open(file, "r");
  let raw;
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error("The log must be a regular file.");
    if (stat.size > maxBytes) throw new Error("The log exceeds the maximum size of 2 MiB.");
    // Bound the actual read too, even if the file grows after stat().
    const bytes = Buffer.alloc(maxBytes + 1);
    let length = 0;
    while (length < bytes.length) {
      const read = await handle.read(bytes, length, bytes.length - length, null);
      if (!read.bytesRead) break;
      length += read.bytesRead;
    }
    if (length > maxBytes) throw new Error("The log exceeds the maximum size of 2 MiB.");
    try {
      raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length));
    } catch {
      throw new Error("The log must contain valid UTF-8 text.");
    }
  } finally {
    await handle.close();
  }

  const result = analyze(raw);
  // Escape untrusted evidence for Markdown; never include the full log.
  const escape = (value) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/`/g, "\uff40");
  const markdownResult = {
    ...result,
    findings: result.findings.map((finding) => ({
      ...finding,
      location: finding.location ? escape(finding.location) : undefined,
      evidence: finding.evidence.map(escape),
    })),
  };
  process.stdout.write(
    `${flags.includes("--json") ? toJSON(result) : toMarkdown(markdownResult)}\n`,
  );
  if (flags.includes("--fail-on-findings") && result.findings.length) process.exitCode = 1;
}

main().catch((error) => {
  // File-system messages can contain user-controlled paths; never echo them.
  const safeCodes = new Set(["ENOENT", "EACCES", "EISDIR", "ENOTDIR", "EPERM", "ELOOP"]);
  const message = safeCodes.has(error?.code)
    ? `Cannot read the log file (${error.code}).`
    : error?.code
      ? "Cannot read the log file."
      : error instanceof Error
        ? error.message
        : "Analysis failed.";
  process.stderr.write(`DevRescue: ${message}\n`);
  process.exitCode = 2;
});
