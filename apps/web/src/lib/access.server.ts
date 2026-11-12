import { z } from "zod";
import type { Q } from "./db.server";
import { COLUMNS_SQL } from "./schema-check";
import { accessSchemaState } from "./access-schema";
import { decideAccess, sponsorshipDecision, SPONSOR_FRESH_MS } from "./access-policy";
import { decryptConnectionKey, encryptConnectionKey } from "./connection-key.server";
import { callAsAppUser } from "../../api/github";
export async function accessInstalled(q: Q) {
  return accessSchemaState(await q(COLUMNS_SQL)) === "compatible";
}
export async function bindGitHub(
  q: Q,
  userId: string,
  profile: { id: string; login: string },
  key: string,
) {
  const rows = await q(
    `INSERT INTO devrescue.github_access (github_id,user_id,github_login,connection_ciphertext)
    VALUES ($1,$2,$3,$4) ON CONFLICT (github_id) DO UPDATE SET connection_ciphertext=EXCLUDED.connection_ciphertext, github_login=EXCLUDED.github_login
    WHERE github_access.user_id=EXCLUDED.user_id RETURNING github_id`,
    [profile.id, userId, profile.login, encryptConnectionKey(key)],
  );
  if (!rows.length) throw new Error("GitHub account already linked to another DevRescue account");
}
export async function beginTrial(q: Q, userId: string) {
  await q(
    "UPDATE devrescue.github_access SET trial_started_at=COALESCE(trial_started_at,now()) WHERE user_id=$1",
    [userId],
  );
}
const rowSchema = z.object({
  github_id: z.string(),
  github_login: z.string(),
  connection_ciphertext: z.string(),
  trial_started_at: z.union([z.date(), z.string()]).nullable(),
  monthly_active: z.boolean(),
  one_time_confirmed: z.boolean(),
  checked_at: z.union([z.date(), z.string()]).nullable(),
});
const githubResult = z.object({
  errors: z.array(z.unknown()).optional(),
  data: z
    .object({
      viewer: z.object({
        databaseId: z.number().int().positive(),
        sponsorshipsAsSponsor: z.object({
          nodes: z.array(
            z
              .object({
                isActive: z.boolean(),
                isOneTimePayment: z.boolean(),
                sponsorable: z.object({ login: z.string() }),
              })
              .nullable(),
          ),
          pageInfo: z.object({ hasNextPage: z.boolean() }),
        }),
      }),
    })
    .optional(),
});
export async function getAccess(q: Q, userId: string, refresh = false) {
  const [raw] = await q("SELECT * FROM devrescue.github_access WHERE user_id=$1", [userId]);
  if (!raw)
    return {
      allowed: false,
      state: "github_required" as const,
      expiresAt: null,
      remainingMs: 0,
      githubLogin: null,
    };
  const row = rowSchema.parse(raw);
  let checkedAt = row.checked_at ? new Date(row.checked_at).getTime() : null;
  let monthlyActive = row.monthly_active;
  let oneTimeConfirmed = row.one_time_confirmed;
  if (refresh || checkedAt === null || Date.now() - checkedAt >= SPONSOR_FRESH_MS) {
    try {
      const response = await callAsAppUser(
        decryptConnectionKey(row.connection_ciphertext),
        "/graphql",
        {
          query: `query { viewer { databaseId sponsorshipsAsSponsor(first:100,activeOnly:false,maintainerLogins:["brunnojob"]) { nodes { isActive isOneTimePayment sponsorable { ... on User { login } ... on Organization { login } } } pageInfo { hasNextPage } } } }`,
        },
      );
      if (!response.ok) throw new Error("Verification unavailable");
      const result = githubResult.parse(await response.json());
      const viewer = result.data?.viewer;
      if (
        result.errors?.length ||
        !viewer ||
        String(viewer.databaseId) !== row.github_id ||
        viewer.sponsorshipsAsSponsor.pageInfo.hasNextPage
      )
        throw new Error("Verification unavailable");
      const decision = sponsorshipDecision(
        viewer.sponsorshipsAsSponsor.nodes.filter((n) => n !== null),
      );
      monthlyActive = decision.monthlyActive;
      oneTimeConfirmed ||= decision.oneTimeConfirmed;
      const [stored] = await q<{ checked_at: Date | string }>(
        "UPDATE devrescue.github_access SET monthly_active=$2,one_time_confirmed=one_time_confirmed OR $3,checked_at=now() WHERE user_id=$1 RETURNING checked_at",
        [userId, monthlyActive, oneTimeConfirmed],
      );
      checkedAt = stored ? new Date(stored.checked_at).getTime() : null;
    } catch {
      checkedAt = null;
      monthlyActive = false;
    }
  }
  return {
    ...decideAccess(
      {
        trialStartedAt: row.trial_started_at ? new Date(row.trial_started_at).getTime() : null,
        monthlyActive,
        oneTimeConfirmed,
        checkedAt,
      },
      Date.now(),
    ),
    githubLogin: row.github_login,
  };
}
export async function requireAccess(q: Q, userId: string) {
  if (!(await accessInstalled(q))) throw new Error("Access setup pending");
  if (!(await getAccess(q, userId)).allowed)
    throw new Error("Trial ended or GitHub sponsorship not verified");
}
