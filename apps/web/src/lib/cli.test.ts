// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import ts from "typescript";

const directory = mkdtempSync(join(tmpdir(), "devrescue-cli-"));
const cli = resolve("bin/devrescue.js");
let sequence = 0;
function run(content: string | Buffer, ...flags: string[]) {
  const file = join(directory, `log-${sequence++}.txt`);
  writeFileSync(file, content);
  return spawnSync(process.execPath, [cli, "analyze", file, ...flags], {
    encoding: "utf8",
    timeout: 10000,
  });
}
afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("release CLI", () => {
  it("ships the current shared analyzer", () => {
    const expected = ts.transpileModule(readFileSync(resolve("src/lib/analyzer.ts"), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    expect(readFileSync(resolve("bin/analyzer.cjs"), "utf8")).toBe(expected);
  });
  it("groups errors and retains file and line", () => {
    const line =
      "src/app.ts(12,3): error TS2322: Type 'string' is not assignable to type 'number'.";
    const result = run(`${line}\n${line}`, "--json");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).findings[0]).toMatchObject({
      occurrences: 2,
      location: "src/app.ts:12:3",
    });
  });
  it("redacts secrets in exported evidence and excludes the full log", () => {
    const result = run(
      "npm ERR! code ERESOLVE password=hunter2\nprivate unrelated log text",
      "--json",
    );
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("hunter2");
    expect(result.stdout).not.toContain("private unrelated log text");
    expect(JSON.parse(result.stdout).redactions).toBe(1);
  });
  it("returns 1 for findings only when requested", () => {
    expect(run("npm ERR! code ERESOLVE", "--fail-on-findings").status).toBe(1);
    expect(run("npm ERR! code ERESOLVE").status).toBe(0);
  });
  it("returns 0 with no supported findings even in fail mode", () => {
    expect(run("Build succeeded", "--fail-on-findings").status).toBe(0);
  });
  it("accepts exactly 2 MiB", () => {
    expect(run(Buffer.alloc(2097152, 10), "--json").status).toBe(0);
  });
  it("rejects more than 2 MiB", () => {
    const result = run(Buffer.alloc(2097153, 97));
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
  });
  it("handles a single long line within the 2 MiB limit", () => {
    expect(run(Buffer.alloc(2097152, 97), "--json").status).toBe(0);
  });
  it("rejects invalid UTF-8", () => {
    expect(run(Buffer.from([0xc3, 0x28])).status).toBe(2);
  });
  it("rejects ambiguous or unknown options", () => {
    expect(run("", "--json", "--markdown").status).toBe(2);
    expect(run("", "--execute").status).toBe(2);
  });
  it("returns a safe error for a missing file", () => {
    const result = spawnSync(process.execPath, [cli, "analyze", join(directory, "secret-path")], {
      encoding: "utf8",
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("ENOENT");
    expect(result.stderr).not.toContain("secret-path");
  });
});
