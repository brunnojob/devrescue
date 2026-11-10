// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, expect, it } from "vitest";
import { beginTrial, accessInstalled } from "./access.server";
import type { Q } from "./db.server";
let db: PGlite;
let q: Q;
const uid = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
beforeEach(async () => {
  db = new PGlite();
  await db.exec(readFileSync(new URL("../../db/devrescue-schema.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../../db/devrescue-access.sql", import.meta.url), "utf8"));
  q = (async (sql: string, values?: unknown[]) =>
    (await db.query(sql, values as never[])).rows) as Q;
  await q(
    "INSERT INTO devrescue.users(id,email,password_hash) VALUES($1,'a@example.com','unused'),($2,'b@example.com','unused')",
    [uid, other],
  );
  await q(
    "INSERT INTO devrescue.github_access(github_id,user_id,github_login,connection_ciphertext) VALUES('123',$1,'account-a','unused'),('456',$2,'account-b','unused')",
    [uid, other],
  );
});
afterEach(async () => {
  await db.close();
});
it("recognizes the separate reviewed access schema", async () => {
  expect(await accessInstalled(q)).toBe(true);
});
it("concurrent starts and repeat starts cannot reset the original trial", async () => {
  await q(
    "UPDATE devrescue.github_access SET trial_started_at='2026-11-10T12:00:00Z' WHERE user_id=$1",
    [uid],
  );
  await Promise.all(Array.from({ length: 10 }, () => beginTrial(q, uid)));
  const [r] = await q<{ trial_started_at: Date }>(
    "SELECT trial_started_at FROM devrescue.github_access WHERE user_id=$1",
    [uid],
  );
  expect(new Date(r?.trial_started_at ?? 0).toISOString()).toBe("2026-11-10T12:00:00.000Z");
});
it("starting one user's trial does not start another user's trial", async () => {
  await beginTrial(q, uid);
  const [r] = await q<{ trial_started_at: Date | null }>(
    "SELECT trial_started_at FROM devrescue.github_access WHERE user_id=$1",
    [other],
  );
  expect(r?.trial_started_at).toBeNull();
});
it("one GitHub identity cannot be attached to two app accounts", async () => {
  await expect(
    q(
      "INSERT INTO devrescue.github_access(github_id,user_id,github_login,connection_ciphertext) VALUES('123',$1,'account-a','unused')",
      [other],
    ),
  ).rejects.toThrow();
});
it("account deletion cannot erase the trial and allow re-registration", async () => {
  await beginTrial(q, uid);
  await expect(q("DELETE FROM devrescue.users WHERE id=$1", [uid])).rejects.toThrow();
});
