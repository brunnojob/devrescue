import { describe, it, expect } from "vitest";
import { csrfFor, csrfMatches, hashPassword, verifyPassword } from "./crypto.server";

describe("crypto", () => {
  it("verifies only the right password", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h).not.toContain("correct");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong horse battery", h)).toBe(false);
  });
  it("binds CSRF tokens to the session", async () => {
    expect(await csrfMatches("session-a", await csrfFor("session-a"))).toBe(true);
    expect(await csrfMatches("session-b", await csrfFor("session-a"))).toBe(false);
    expect(await csrfMatches("session-a", undefined)).toBe(false);
  });
});
