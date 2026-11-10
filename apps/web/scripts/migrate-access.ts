import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildDbConfig, describeDbError, withDbConfig } from "../src/lib/db.server";
import { COLUMNS_SQL, evaluateSchema } from "../src/lib/schema-check";
import { accessSchemaState } from "../src/lib/access-schema";
const sql = readFileSync(new URL("../db/devrescue-access.sql", import.meta.url), "utf8");
const hash = createHash("sha256").update(sql).digest("hex");
const cfg = buildDbConfig(
  {
    DATABASE_URL: process.env["MIGRATION_DATABASE_URL"],
    PGSSLROOTCERT_PEM: process.env["PGSSLROOTCERT_PEM"],
  },
  "MIGRATION_DATABASE_URL",
);
console.log("Reviewed access schema sha256:", hash);
if (!cfg.ok) {
  console.error("Pending: installation setting missing or rejected.");
  process.exit(2);
}
try {
  await withDbConfig(cfg.config, async (q) => {
    const rows = await q<{ table_name: string; column_name: string }>(COLUMNS_SQL);
    if (evaluateSchema(rows).state !== "compatible") throw new Error("Base schema incompatible");
    const state = accessSchemaState(rows);
    console.log("Access preflight:", state);
    if (state === "compatible") return;
    if (state === "incompatible") throw new Error("Access schema incompatible");
    if (!process.argv.includes("--apply")) return console.log("Dry run only; no changes.");
    if (!process.argv.includes(`--schema-sha256=${hash}`))
      throw new Error("Reviewed hash mismatch");
    await q(sql);
    console.log("Access post-check:", accessSchemaState(await q(COLUMNS_SQL)));
  });
} catch (e) {
  const message = e instanceof Error ? e.message : "";
  console.error(
    ["Base schema incompatible", "Access schema incompatible", "Reviewed hash mismatch"].includes(
      message,
    )
      ? message
      : describeDbError(e),
  );
  process.exit(1);
}
