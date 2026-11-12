import { describe, it, expect } from "vitest";
import { analyze } from "./analyzer";
import { buildPlan, sourceExcerpt, sourceHints } from "./diagnosis";

describe("diagnosis plan", () => {
  it("groups repeats and marks the root cause of cascaded errors", () => {
    const log = [
      "Error: Cannot find module 'zod'",
      "src/a.ts(3,1): error TS2307: Cannot find module 'zod'.",
      "src/a.ts(3,1): error TS2307: Cannot find module 'zod'.",
      "Error: Process completed with exit code 1.",
    ].join("\n");
    const p = buildPlan(analyze(log));
    const root = p.diagnoses.find((d) => d.ruleId === "node-missing-module")!;
    const ts = p.diagnoses.find((d) => d.ruleId === "ts-diagnostic")!;
    const ci = p.diagnoses.find((d) => d.ruleId === "ci-exit")!;
    expect(ts.occurrences).toBe(2);
    expect(ts.causedBy).toBe(root.id);
    expect(ci.causedBy).toBe(root.id);
    expect(p.roots.map((r) => r.ruleId)).toEqual(["node-missing-module"]);
    expect(p.nextAction?.verify).toContain("npm");
  });
  it("extracts file and line plus a log snippet", () => {
    const p = buildPlan(
      analyze("x\nsrc/b.tsx(12,5): error TS2304: Cannot find name 'useState'.\ny"),
    );
    const d = p.diagnoses[0]!;
    expect(d.file).toBe("src/b.tsx");
    expect(d.line).toBe(12);
    expect(d.snippet.some((l) => l.startsWith(">"))).toBe(true);
  });
  it("uses the source file for a concrete fix", () => {
    const d = buildPlan(analyze("src/b.tsx(2,5): error TS2304: Cannot find name 'useState'."))
      .diagnoses[0]!;
    const src = 'import React from "react";\nconst [a] = useState(0);';
    expect(sourceHints(d, src)[0]).toContain("never declared or imported");
    expect(sourceExcerpt(src, 2, 1)[1]).toMatch(/^> +2 \|/);
  });
});
