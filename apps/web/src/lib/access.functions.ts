import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { withDb } from "./db.server";
import { accessInstalled, beginTrial, bindGitHub, getAccess } from "./access.server";
import { requireUser, sessionUser, SESSION_COOKIE } from "./accounts.server";
import { csrfFor, randomToken, sha256Hex } from "./crypto.server";
import {
  authorizeAppUserOAuth,
  callAsAppUser,
  exchangeAppUserOAuthCode,
} from "@/integrations/lovable/appUserConnector";
const csrfInput = z.object({ csrf: z.string().max(100) });
const noStore = () => setResponseHeader("cache-control", "no-store");
export const accessStatus = createServerFn({ method: "GET" }).handler(async () => {
  noStore();
  const token = getCookie(SESSION_COOKIE);
  if (!token)
    return {
      state: "sign_in" as const,
      allowed: false,
      csrf: null,
      githubLogin: null,
      expiresAt: null,
      remainingMs: 0,
    };
  try {
    return await withDb(async (q) => {
      if (!(await accessInstalled(q)))
        return {
          state: "setup_pending" as const,
          allowed: false,
          csrf: null,
          githubLogin: null,
          expiresAt: null,
          remainingMs: 0,
        };
      const user = await sessionUser(q, token);
      if (!user || !token)
        return {
          state: "sign_in" as const,
          allowed: false,
          csrf: null,
          githubLogin: null,
          expiresAt: null,
          remainingMs: 0,
        };
      return { ...(await getAccess(q, user.id)), csrf: await csrfFor(token) };
    });
  } catch {
    return {
      state: "setup_pending" as const,
      allowed: false,
      csrf: null,
      githubLogin: null,
      expiresAt: null,
      remainingMs: 0,
    };
  }
});
export const startGitHub = createServerFn({ method: "POST" })
  .inputValidator(csrfInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await withDb(async (q) => {
        const token = getCookie(SESSION_COOKIE);
        const user = await requireUser(q, token, data.csrf);
        if (!token || !(await accessInstalled(q))) throw new Error("Setup pending");
        const request = getRequest();
        const url = new URL(request.url);
        const forwarded =
          url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
        const origin =
          forwarded && /^[a-z0-9.-]+\.lovable\.app$/.test(forwarded)
            ? `https://${forwarded}`
            : url.origin;
        const nonce = randomToken();
        const callback = new URL("/api/public/github/return", origin);
        callback.searchParams.set("nonce", nonce);
        await q(
          `INSERT INTO devrescue.github_oauth_pending(user_id,nonce_hash,session_hash,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')
        ON CONFLICT(user_id) DO UPDATE SET nonce_hash=EXCLUDED.nonce_hash,session_hash=EXCLUDED.session_hash,expires_at=EXCLUDED.expires_at`,
          [user.id, await sha256Hex(nonce), await sha256Hex(token)],
        );
        return {
          ok: true as const,
          ...(await authorizeAppUserOAuth({ appUserId: user.id, returnUrl: callback.toString() })),
          nonce,
        };
      });
    } catch {
      return { ok: false as const, error: "Could not connect GitHub. Check account setup." };
    }
  });
export const completeGitHub = createServerFn({ method: "POST" })
  .inputValidator(
    csrfInput.extend({ code: z.string().min(1).max(4096), nonce: z.string().min(1).max(100) }),
  )
  .handler(async ({ data }) => {
    noStore();
    try {
      await withDb(async (q) => {
        const token = getCookie(SESSION_COOKIE);
        const user = await requireUser(q, token, data.csrf);
        if (!token) throw new Error("Not signed in");
        const pending = await q(
          "DELETE FROM devrescue.github_oauth_pending WHERE user_id=$1 AND nonce_hash=$2 AND session_hash=$3 AND expires_at>now() RETURNING user_id",
          [user.id, await sha256Hex(data.nonce), await sha256Hex(token)],
        );
        if (!pending.length) throw new Error("Invalid OAuth completion");
        const exchanged = await exchangeAppUserOAuthCode(data.code);
        const response = await callAsAppUser(exchanged.connectionAPIKey, "/user");
        if (!response.ok) throw new Error("GitHub identity unavailable");
        const profile = z
          .object({ id: z.number().int().positive(), login: z.string().min(1).max(100) })
          .parse(await response.json());
        await bindGitHub(
          q,
          user.id,
          { id: String(profile.id), login: profile.login },
          exchanged.connectionAPIKey,
        );
        await getAccess(q, user.id, true);
      });
      return { ok: true as const };
    } catch {
      return {
        ok: false as const,
        error: "Could not verify GitHub account. Reconnect or use the original DevRescue account.",
      };
    }
  });
export const startTrial = createServerFn({ method: "POST" })
  .inputValidator(csrfInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      await withDb(async (q) => {
        const user = await requireUser(q, getCookie(SESSION_COOKIE), data.csrf);
        const access = await getAccess(q, user.id);
        if (access.state === "github_required") throw new Error("GitHub required");
        await beginTrial(q, user.id);
      });
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "Could not start trial. Connect GitHub first." };
    }
  });
export const recheckSponsor = createServerFn({ method: "POST" })
  .inputValidator(csrfInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      await withDb(async (q) => {
        const u = await requireUser(q, getCookie(SESSION_COOKIE), data.csrf);
        await getAccess(q, u.id, true);
      });
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "Sponsorship verification unavailable." };
    }
  });
