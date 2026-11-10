import { describe, expect, it } from "vitest";
import { classifyDbError, DIAGNOSES } from "./db-diagnosis";

describe("classifyDbError", () => {
  it("separates timeouts, auth and certificate failures", () => {
    expect(classifyDbError(new Error("timeout expired"))).toBe("timeout");
    expect(classifyDbError({ code: "ETIMEDOUT" })).toBe("timeout");
    expect(
      classifyDbError({ code: "28P01", message: "password authentication failed for user x" }),
    ).toBe("auth");
    expect(classifyDbError({ code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" })).toBe("tls");
    expect(classifyDbError({ code: "SELF_SIGNED_CERT_IN_CHAIN" })).toBe("tls");
    expect(classifyDbError({ code: "ENOTFOUND" })).toBe("dns");
    expect(classifyDbError({ code: "ECONNREFUSED" })).toBe("refused");
    expect(classifyDbError({ code: "3D000" })).toBe("database_missing");
    expect(classifyDbError(null)).toBe("other");
  });
  it("next steps never ask for credentials in chat", () => {
    const text = JSON.stringify(DIAGNOSES);
    expect(text).not.toMatch(/paste (it|your password) here/i);
    expect(text).toMatch(/Never paste it in chat/);
  });
});
