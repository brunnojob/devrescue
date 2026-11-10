import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  setCookie,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { z } from "zod";
import { credentialsSchema, parseSyncReport } from "./sync-report";
import { probeDb, withDb, type DbState } from "./db.server";
import * as A from "./accounts.server";
import { csrfFor } from "./crypto.server";

const cookie = () => getCookie(A.SESSION_COOKIE);
const setSession = (token: string) =>
  setCookie(A.SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: A.SESSION_DAYS * 86400,
  });
const noStore = () => setResponseHeader("cache-control", "no-store");
const fail = (e: unknown) => {
  const msg = e instanceof Error ? e.message : "";
  const safe = [
    "Not signed in",
    "Report too large",
    "Report limit reached; delete old reports first",
    "Database not configured",
  ];
  if (!safe.includes(msg))
    console.error("devrescue: request failed", (e as { code?: string }).code ?? "");
  return {
    ok: false as const,
    error: safe.includes(msg) ? msg : e instanceof z.ZodError ? "Invalid input" : "Request failed",
  };
};

export const getSyncStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    db: DbState;
    missing: string[];
    detail?: string;
    user: { email: string } | null;
    csrf: string | null;
  }> => {
    noStore();
    const probe = await probeDb();
    if (probe.state !== "ready")
      return {
        db: probe.state,
        missing: probe.missing,
        ...(probe.detail ? { detail: probe.detail } : {}),
        user: null,
        csrf: null,
      };
    const token = cookie();
    if (!token) return { db: "ready", missing: [], user: null, csrf: null }; // no DB hit for anonymous callers
    const user = await withDb((q) => A.sessionUser(q, token)).catch(() => null);
    return {
      db: "ready",
      missing: [],
      user: user ? { email: user.email } : null,
      csrf: user && token ? await csrfFor(token) : null,
    };
  },
);

const authInput = (d: unknown) =>
  credentialsSchema.extend({ mode: z.enum(["login", "register"]) }).parse(d);
export const authenticate = createServerFn({ method: "POST" })
  .validator(authInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      const res = await withDb(async (q) => {
        if (data.mode === "register") {
          const id = await A.register(q, data.email, data.password);
          if (!id) return { error: "Could not create account" };
          return { token: await A.createSession(q, id) };
        }
        const r = await A.login(q, data.email, data.password);
        return "error" in r ? r : { token: await A.createSession(q, r.userId) };
      });
      if ("error" in res) return { ok: false as const, error: res.error };
      setSession(res.token);
      return { ok: true as const };
    } catch (e) {
      return fail(e);
    }
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  noStore();
  const token = cookie();
  await withDb((q) => A.destroySession(q, token)).catch(() => {});
  deleteCookie(A.SESSION_COOKIE, { path: "/" });
  return { ok: true as const };
});

const csrfOnly = (d: unknown) => z.object({ csrf: z.string().max(100) }).parse(d);
export const listRemoteReports = createServerFn({ method: "POST" })
  .validator(csrfOnly)
  .handler(async ({ data }) => {
    noStore();
    try {
      return {
        ok: true as const,
        reports: await withDb(async (q) =>
          A.listReports(q, (await A.requireUser(q, cookie(), data.csrf)).id),
        ),
      };
    } catch (e) {
      return fail(e);
    }
  });

export const uploadReport = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ csrf: z.string().max(100), report: z.unknown() }).parse(d))
  .handler(async ({ data }) => {
    noStore();
    try {
      const report = parseSyncReport(data.report);
      return {
        ok: true as const,
        id: await withDb(async (q) =>
          A.createReport(q, (await A.requireUser(q, cookie(), data.csrf)).id, report),
        ),
      };
    } catch (e) {
      return fail(e);
    }
  });

export const deleteRemoteReport = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ csrf: z.string().max(100), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    noStore();
    try {
      return {
        ok: true as const,
        deleted: await withDb(async (q) =>
          A.deleteReport(q, (await A.requireUser(q, cookie(), data.csrf)).id, data.id),
        ),
      };
    } catch (e) {
      return fail(e);
    }
  });
