// @vitest-environment node
// Runs the real SQL against an in-memory PostgreSQL (PGlite) loaded with db/devrescue-schema.sql.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import * as A from "./accounts.server";
import type { Q } from "./db.server";
import { probeWith } from "./db.server";
import { csrfFor } from "./crypto.server";
import { toSyncReport } from "./sync-report";
import { analyze } from "./analyzer";

const SCHEMA = readFileSync(new URL("../../db/devrescue-schema.sql", import.meta.url), "utf8");
const report = toSyncReport(analyze("Error: listen EADDRINUSE: address already in use :::3000"));
const PW = "correct horse battery";
let db: PGlite;
let q: Q;
const qOf = (d: PGlite): Q =>
  (async (text: string, values?: unknown[]) => (await d.query(text, values as never[])).rows) as Q;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(SCHEMA);
  q = qOf(db);
});
const user = async (email: string) => {
  const id = await A.register(q, email, PW);
  if (!id) throw new Error("register failed");
  const token = await A.createSession(q, id);
  return { id, token, csrf: await csrfFor(token) };
};

describe("cross-user isolation", () => {
  it("users only list and delete their own reports", async () => {
    const a = await user("a@example.com");
    const b = await user("b@example.com");
    const rid = await A.createReport(q, a.id, report);
    expect(await A.listReports(q, b.id)).toEqual([]);
    expect(await A.deleteReport(q, b.id, rid)).toBe(false);
    expect((await A.listReports(q, a.id)).map((r) => r.id)).toEqual([rid]);
    expect(await A.deleteReport(q, a.id, rid)).toBe(true);
  });
});

describe("session and CSRF", () => {
  it("accepts the matching session + CSRF pair", async () => {
    const a = await user("a@example.com");
    expect((await A.requireUser(q, a.token, a.csrf)).email).toBe("a@example.com");
  });
  it("rejects a tampered CSRF token, another session's CSRF, a tampered or expired session", async () => {
    const a = await user("a@example.com");
    const b = await user("b@example.com");
    await expect(A.requireUser(q, a.token, a.csrf.slice(0, -1) + "x")).rejects.toThrow(
      "Not signed in",
    );
    await expect(A.requireUser(q, a.token, b.csrf)).rejects.toThrow("Not signed in");
    await expect(A.requireUser(q, a.token + "x", a.csrf)).rejects.toThrow("Not signed in");
    await q("UPDATE devrescue.sessions SET expires_at = now() - interval '1 second'");
    await expect(A.requireUser(q, a.token, a.csrf)).rejects.toThrow("Not signed in");
  });
  it("sign-out invalidates the session", async () => {
    const a = await user("a@example.com");
    await A.destroySession(q, a.token);
    await expect(A.requireUser(q, a.token, a.csrf)).rejects.toThrow("Not signed in");
  });
});

describe("lockout", () => {
  it("locks after 5 failures, even for the right password", async () => {
    await user("a@example.com");
    for (let i = 0; i < A.LOCK_AFTER; i++) await A.login(q, "a@example.com", "wrong password!!");
    expect(await A.login(q, "a@example.com", PW)).toEqual({
      error: expect.stringMatching(/Too many/),
    });
  });
  it("one failure after the lock expires does not re-lock (counter restarts at 1)", async () => {
    await user("a@example.com");
    for (let i = 0; i < A.LOCK_AFTER; i++) await A.login(q, "a@example.com", "wrong password!!");
    await q("UPDATE devrescue.users SET locked_until = now() - interval '1 second'");
    expect(await A.login(q, "a@example.com", "wrong password!!")).toEqual({
      error: "Invalid email or password",
    });
    const [u] = await q<{ failed_logins: number; locked_until: unknown }>(
      "SELECT failed_logins, locked_until FROM devrescue.users",
    );
    expect(u).toEqual({ failed_logins: 1, locked_until: null });
    expect(await A.login(q, "a@example.com", PW)).toHaveProperty("userId");
  });
});

describe("report cap", () => {
  it("10 concurrent uploads with 3 slots left store exactly 3", async () => {
    const a = await user("a@example.com");
    await q("UPDATE devrescue.users SET report_count = $1", [A.MAX_REPORTS_PER_USER - 3]);
    const res = await Promise.allSettled(
      Array.from({ length: 10 }, () => A.createReport(q, a.id, report)),
    );
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const [c] = await q<{ report_count: number }>("SELECT report_count FROM devrescue.users");
    expect(c?.report_count).toBe(A.MAX_REPORTS_PER_USER);
    expect(await A.listReports(q, a.id)).toHaveLength(3);
  });
  it("deleting frees a slot", async () => {
    const a = await user("a@example.com");
    await q("UPDATE devrescue.users SET report_count = $1", [A.MAX_REPORTS_PER_USER - 1]);
    const rid = await A.createReport(q, a.id, report);
    await expect(A.createReport(q, a.id, report)).rejects.toThrow("Report limit reached");
    await A.deleteReport(q, a.id, rid);
    await expect(A.createReport(q, a.id, report)).resolves.toMatch(/-/);
  });
});

describe("schema preflight", () => {
  it("is ready on the reviewed schema", async () => {
    expect((await probeWith(q)).state).toBe("ready");
  });
  it("flags the old public-repo owner_id table as incompatible and the schema file refuses it", async () => {
    const old = new PGlite();
    await old.exec(
      "CREATE SCHEMA devrescue; CREATE TABLE devrescue.reports (id uuid PRIMARY KEY, owner_id varchar(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), report jsonb NOT NULL);",
    );
    const p = await probeWith(qOf(old));
    expect(p.state).toBe("schema_incompatible");
    expect(p.detail).toMatch(/owner_id/);
    await expect(old.exec(SCHEMA)).rejects.toThrow(/already exists/);
    await old.exec("ROLLBACK"); // the failed file left its transaction aborted; nothing was committed
    const cols = await old.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'reports'",
    );
    expect(cols.rows.map((r) => (r as { column_name: string }).column_name)).toContain("owner_id");
    const users = await old.query("SELECT to_regclass('devrescue.users') AS t");
    expect(users.rows[0]).toEqual({ t: null }); // partial apply rolled back
  });
});
