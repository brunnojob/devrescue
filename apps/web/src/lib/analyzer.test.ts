import { describe, it, expect } from "vitest";
import { analyze, compareLogs, redact, stripAnsi } from "./analyzer";
import { SAMPLES } from "./samples";

// SAMPLES is indexed by display name, and tsconfig sets noUncheckedIndexedAccess,
// so a raw index yields string | undefined. Keep the fallback in one place.
const sample = (name: string) => SAMPLES[name] ?? "";
const ids = (s: string) => analyze(s).findings.map((f) => f.ruleId);

describe("analyzer", () => {
  it("strips ANSI", () => expect(stripAnsi("\x1b[31mred\x1b[0m")).toBe("red"));
  it("redacts URLs, tokens, passwords", () => {
    const { text } = redact(
      "postgres://u:pw@h/db password=hunter2 ghp_abcdefghijklmnopqrstuvwxyz0123",
    );
    expect(text).not.toContain("pw@");
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("ghp_abc");
  });
  it("finds TS location and dedupes repeats", () => {
    const r = analyze(sample("Node / TypeScript build"));
    const ts = r.findings.filter((f) => f.ruleId === "ts-diagnostic");
    expect(ts).toHaveLength(2);
    expect(ts.find((f) => f.location === "src/api/client.ts:42:7")?.occurrences).toBe(2);
    expect(ids(sample("Node / TypeScript build"))).toEqual(
      expect.arrayContaining(["npm-missing-script", "eaddrinuse", "oom"]),
    );
  });
  it("missing module supersedes traceback", () => {
    const i = ids(sample("Python service"));
    expect(i).toContain("py-missing-module");
    expect(i).not.toContain("py-traceback");
    expect(i).toContain("pg-connection");
    expect(i).not.toContain("dns");
  });
  it("detects npm/docker/git/network/tests", () => {
    expect(ids(sample("npm install conflict"))).toEqual(
      expect.arrayContaining(["npm-eresolve", "enospc"]),
    );
    expect(ids(sample("Docker / Git / network"))).toEqual(
      expect.arrayContaining(["docker-permission", "git-conflict", "dns", "tls", "tests-failed"]),
    );
  });
  it("compares logs", () => {
    const c = compareLogs("Error: listen EADDRINUSE :::3000", "npm ERR! code ERESOLVE");
    expect(c.resolved[0]?.ruleId).toBe("eaddrinuse");
    expect(c.introduced[0]?.ruleId).toBe("npm-eresolve");
  });
});
