// Manual end-to-end check against the real database (run only after the schema is applied):
//   DATABASE_URL=... bun scripts/verify-remote.ts
// SELECT 1, then create/read/delete a synthetic user + report, and clean up.
import { probeDb, withDb } from "../src/lib/db.server";
import * as A from "../src/lib/accounts.server";
import { analyze } from "../src/lib/analyzer";
import { toSyncReport } from "../src/lib/sync-report";

const p = await probeDb();
console.log("probe:", p.state, p.detail ?? "");
if (p.state !== "ready") process.exit(1);
await withDb(async (q) => {
  const email = `synthetic-${crypto.randomUUID()}@devrescue.invalid`;
  const uid = await A.register(q, email, crypto.randomUUID());
  if (!uid) throw new Error("register failed");
  try {
    const id = await A.createReport(
      q,
      uid,
      toSyncReport(analyze("Error: listen EADDRINUSE: address already in use :::3000")),
    );
    const read = await A.listReports(q, uid);
    if (!read.some((r) => r.id === id)) throw new Error("read failed");
    if (!(await A.deleteReport(q, uid, id))) throw new Error("delete failed");
    console.log("create/read/delete: OK");
  } finally {
    await q("DELETE FROM devrescue.users WHERE id = $1", [uid]);
  }
});
