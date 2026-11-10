// Pure access decisions. Never trust a browser clock or a client-supplied sponsorship.
export const TRIAL_MS = 3 * 60 * 60 * 1000;
export const SPONSOR_LOGIN = "brunnojob";
export const SPONSOR_FRESH_MS = 5 * 60 * 1000;
export type AccessState =
  "trial_available" | "trial" | "sponsor" | "expired" | "verification_unavailable";
export function decideAccess(
  input: {
    trialStartedAt: number | null;
    monthlyActive: boolean;
    oneTimeConfirmed: boolean;
    checkedAt: number | null;
  },
  now: number,
) {
  const expiresAt = input.trialStartedAt === null ? null : input.trialStartedAt + TRIAL_MS;
  const fresh =
    input.checkedAt !== null && input.checkedAt <= now && now - input.checkedAt < SPONSOR_FRESH_MS;
  const sponsor = input.oneTimeConfirmed || (fresh && input.monthlyActive);
  const trial = expiresAt !== null && now < expiresAt && now >= (input.trialStartedAt ?? now);
  const state: AccessState = sponsor
    ? "sponsor"
    : trial
      ? "trial"
      : expiresAt === null
        ? "trial_available"
        : fresh
          ? "expired"
          : "verification_unavailable";
  return {
    allowed: sponsor || trial,
    state,
    expiresAt,
    remainingMs: trial && expiresAt ? expiresAt - now : 0,
  };
}

export function sponsorshipDecision(
  nodes: { isActive: boolean; isOneTimePayment: boolean; sponsorable: { login: string } }[],
) {
  const ours = nodes.filter((n) => n.sponsorable.login.toLowerCase() === SPONSOR_LOGIN);
  return {
    monthlyActive: ours.some((n) => n.isActive && !n.isOneTimePayment),
    oneTimeConfirmed: ours.some((n) => n.isOneTimePayment),
  };
}
