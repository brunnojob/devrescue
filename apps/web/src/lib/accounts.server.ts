// Server-only account/session/report store over an injected query function (testable with a fake).
import type { Q } from "./db.server";
import { csrfMatches, hashPassword, randomToken, sha256Hex, verifyPassword } from "./crypto.server";
import type { SyncReport } from "./sync-report";

export const SESSION_COOKIE = "devrescue_session";
export const SESSION_DAYS = 7;
export const MAX_REPORTS_PER_USER = 200;
export const LOCK_AFTER = 5;
// Dummy hash so unknown emails cost the same as wrong passwords (no user enumeration by timing).
const DUMMY = "pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export async function register(q: Q, email: string, password: string) {
  const exists = await q("SELECT 1 FROM devrescue.users WHERE email = $1", [email]);
  if (exists.length) return null;
  const id = crypto.randomUUID();
  await q("INSERT INTO devrescue.users (id, email, password_hash) VALUES ($1, $2, $3)", [
    id,
    email,
    await hashPassword(password),
  ]);
  return id;
}

export async function login(
  q: Q,
  email: string,
  password: string,
): Promise<{ userId: string } | { error: string }> {
  const [u] = await q<{
    id: string;
    password_hash: string;
    failed_logins: number;
    locked: boolean;
  }>(
    "SELECT id, password_hash, failed_logins, (locked_until IS NOT NULL AND locked_until > now()) AS locked FROM devrescue.users WHERE email = $1",
    [email],
  );
  const ok = await verifyPassword(password, u?.password_hash ?? DUMMY);
  if (!u) return { error: "Invalid email or password" };
  if (u.locked) return { error: "Too many attempts. Try again in 15 minutes." };
  if (!ok) {
    // An expired lock starts a fresh window (count = 1) instead of re-locking on the next miss.
    await q(
      `UPDATE devrescue.users SET
         failed_logins = CASE WHEN locked_until IS NOT NULL AND locked_until <= now() THEN 1 ELSE failed_logins + 1 END,
         locked_until = CASE
           WHEN (CASE WHEN locked_until IS NOT NULL AND locked_until <= now() THEN 1 ELSE failed_logins + 1 END) >= $2
             THEN now() + interval '15 minutes'
           ELSE NULL END
       WHERE id = $1`,
      [u.id, LOCK_AFTER],
    );
    return { error: "Invalid email or password" };
  }
  await q("UPDATE devrescue.users SET failed_logins = 0, locked_until = NULL WHERE id = $1", [
    u.id,
  ]);
  return { userId: u.id };
}

export async function createSession(q: Q, userId: string) {
  const token = randomToken();
  await q("DELETE FROM devrescue.sessions WHERE user_id = $1 AND expires_at < now()", [userId]);
  await q(
    `INSERT INTO devrescue.sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`,
    [await sha256Hex(token), userId],
  );
  return token;
}

export async function sessionUser(q: Q, token: string | undefined) {
  if (!token || token.length > 100) return null;
  const [r] = await q<{ id: string; email: string }>(
    "SELECT u.id, u.email FROM devrescue.sessions s JOIN devrescue.users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()",
    [await sha256Hex(token)],
  );
  return r ?? null;
}

/** For state-changing calls: valid session AND matching CSRF token. */
export async function requireUser(q: Q, token: string | undefined, csrf: unknown) {
  const u = await sessionUser(q, token);
  if (!u || !token || !(await csrfMatches(token, csrf))) throw new Error("Not signed in");
  return u;
}

export async function destroySession(q: Q, token: string | undefined) {
  if (token)
    await q("DELETE FROM devrescue.sessions WHERE token_hash = $1", [await sha256Hex(token)]);
}

export async function listReports(q: Q, userId: string) {
  const rows = await q<{ id: string; created_at: Date | string; report: SyncReport }>(
    "SELECT id, created_at, report FROM devrescue.reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100",
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    createdAt: new Date(r.created_at).toISOString(),
    report: r.report,
  }));
}

/** Atomic: the slot increment and insert are one statement; the row lock on users serialises
 * concurrent uploads, and the WHERE is re-checked after waiting, so the cap cannot be exceeded. */
export async function createReport(q: Q, userId: string, report: SyncReport) {
  const id = crypto.randomUUID();
  const rows = await q(
    `WITH slot AS (
       UPDATE devrescue.users SET report_count = report_count + 1
       WHERE id = $1 AND report_count < $2 RETURNING id)
     INSERT INTO devrescue.reports (id, user_id, report)
     SELECT $3, slot.id, $4::jsonb FROM slot RETURNING id`,
    [userId, MAX_REPORTS_PER_USER, id, JSON.stringify(report)],
  );
  if (!rows.length) throw new Error("Report limit reached; delete old reports first");
  return id;
}

export async function deleteReport(q: Q, userId: string, id: string) {
  const rows = await q(
    `WITH d AS (DELETE FROM devrescue.reports WHERE id = $1 AND user_id = $2 RETURNING user_id)
     UPDATE devrescue.users SET report_count = report_count - 1
     WHERE id IN (SELECT user_id FROM d) RETURNING id`,
    [id, userId],
  );
  return rows.length > 0;
}
