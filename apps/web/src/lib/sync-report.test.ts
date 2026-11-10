import { describe, it, expect } from "vitest";
import { analyze } from "./analyzer";
import { LIMITS, parseSyncReport, toSyncReport, credentialsSchema } from "./sync-report";

const log = "password=hunter2supersecret\nError: listen EADDRINUSE: address already in use :::3000";
describe("sync report", () => {
  it("never includes the full log", () => {
    const r = toSyncReport(analyze(log)) as Record<string, unknown>;
    expect(r).not.toHaveProperty("sanitized");
    expect(JSON.stringify(r)).not.toContain("hunter2supersecret");
  });
  it("server re-redacts secrets injected by a client", () => {
    const r = toSyncReport(analyze(log));
    r.findings[0]!.evidence = ["token=ghp_abcdefghijklmnopqrstuvwxyz0123456789"];
    expect(JSON.stringify(parseSyncReport(r))).not.toContain(
      "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
    );
  });
  it("rejects more than 50 findings and oversized payloads", () => {
    const r = toSyncReport(analyze(log));
    const many = {
      ...r,
      findings: Array.from({ length: LIMITS.findings + 1 }, () => r.findings[0]),
    };
    expect(() => parseSyncReport(many)).toThrow();
    expect(() => parseSyncReport({ ...r, title: "x".repeat(70_000) })).toThrow("Report too large");
  });
  it("requires passwords of at least 12 characters", () => {
    expect(credentialsSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(false);
    expect(
      credentialsSchema.safeParse({ email: "A@B.co", password: "long-enough-pw" }).data?.email,
    ).toBe("a@b.co");
  });
});
