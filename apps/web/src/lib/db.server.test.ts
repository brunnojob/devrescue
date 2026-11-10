import { describe, it, expect } from "vitest";
import { buildDbConfig, EXPECTED_HOST } from "./db.server";

describe("db config", () => {
  it("reports DATABASE_URL as missing", () => {
    expect(buildDbConfig({})).toEqual({ ok: false, missing: ["DATABASE_URL"] });
  });
  it("rejects hosts other than the Azure server", () => {
    expect(buildDbConfig({ DATABASE_URL: "postgres://u:p@evil.example.com/db" }).ok).toBe(false);
  });
  it("always verifies TLS even if the URL says sslmode=disable", () => {
    const c = buildDbConfig({
      DATABASE_URL: `postgres://u:p@${EXPECTED_HOST}:5432/db?sslmode=disable`,
    });
    if (!c.ok) throw new Error("expected ok");
    expect(c.config.connectionString).not.toContain("sslmode");
    expect(c.config.ssl).toMatchObject({ rejectUnauthorized: true, servername: EXPECTED_HOST });
  });
});
