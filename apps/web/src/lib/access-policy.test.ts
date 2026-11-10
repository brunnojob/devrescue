import { describe, expect, it } from "vitest";
import { decideAccess, sponsorshipDecision, TRIAL_MS } from "./access-policy";
const base = {
  trialStartedAt: 1000,
  monthlyActive: false,
  oneTimeConfirmed: false,
  checkedAt: 1000,
};
describe("three-hour trial", () => {
  it("is exactly three hours, not a day", () => expect(TRIAL_MS).toBe(10_800_000));
  it("allows access until just before three hours", () =>
    expect(decideAccess(base, 1000 + 10_800_000 - 1).allowed).toBe(true));
  it("blocks at the exact three-hour boundary", () =>
    expect(decideAccess(base, 1000 + 10_800_000).allowed).toBe(false));
  it("does not grant access before starting", () =>
    expect(decideAccess({ ...base, trialStartedAt: null }, 1000).allowed).toBe(false));
});
describe("any-value sponsorship", () => {
  it("accepts active monthly sponsorship without inspecting an amount", () => {
    const s = sponsorshipDecision([
      { isActive: true, isOneTimePayment: false, sponsorable: { login: "brunnojob" } },
    ]);
    expect(decideAccess({ ...base, ...s, trialStartedAt: null }, 1001).allowed).toBe(true);
  });
  it("accepts historical one-time payments and preserves confirmed access", () => {
    const s = sponsorshipDecision([
      { isActive: false, isOneTimePayment: true, sponsorable: { login: "brunnojob" } },
    ]);
    expect(decideAccess({ ...base, ...s, trialStartedAt: null }, 20_000_000).allowed).toBe(true);
  });
  it("rejects cancelled monthly sponsorship", () =>
    expect(
      sponsorshipDecision([
        { isActive: false, isOneTimePayment: false, sponsorable: { login: "brunnojob" } },
      ]).monthlyActive,
    ).toBe(false));
  it("does not accept sponsorship of another maintainer", () =>
    expect(
      sponsorshipDecision([
        { isActive: true, isOneTimePayment: true, sponsorable: { login: "other" } },
      ]).oneTimeConfirmed,
    ).toBe(false));
  it("fails closed for stale monthly verification after trial", () =>
    expect(decideAccess({ ...base, monthlyActive: true }, 20_000_000).allowed).toBe(false));
});
