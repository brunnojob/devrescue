// Deliberate, reviewed migration for the isolated devrescue schema. Never run automatically.
//   Dry run (default):  bun scripts/migrate-devrescue.ts
//   Apply:              bun scripts/migrate-devrescue.ts --apply --schema-sha256=<hash from dry run>
// Reads the MIGRATION_DATABASE_URL secret from the environment; never prints it.
// Same Azure host check and mandatory verified TLS as the app. Never drops or alters existing data.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildDbConfig, describeDbError, withDbConfig } from "../src/lib/db.server";
import { COLUMNS_SQL, evaluateSchema } from "../src/lib/schema-check";

const sql = readFileSync(new URL("../db/devrescue-schema.sql", import.meta.url), "utf8");
const hash = createHash("sha256").update(sql).digest("hex");
const apply = process.argv.includes("--apply");
const given = process.argv.find((a) => a.startsWith("--schema-sha256="))?.split("=")[1];

const cfg = buildDbConfig(
  {
    DATABASE_URL: process.env["MIGRATION_DATABASE_URL"],
    PGSSLROOTCERT_PEM: process.env["PGSSLROOTCERT_PEM"],
  },
  "MIGRATION_DATABASE_URL",
);
console.log(`schema file sha256: ${hash}`);
if (!cfg.ok) {
  console.error(
    cfg.missing.length ? `Pending: secret ${cfg.missing.join(", ")} is not set.` : cfg.error,
  );
  process.exit(2);
}
try {
  await withDbConfig(cfg.config, async (q) => {
    await q("SELECT 1");
    const v = evaluateSchema(await q(COLUMNS_SQL));
    console.log(`preflight: ${v.state}`);
    v.problems.forEach((p) => console.log(`  - ${p}`));
    if (v.state === "compatible") return console.log("Nothing to do: schema already installed.");
    if (v.state === "incompatible")
      throw Object.assign(new Error("incompatible"), { code: "INCOMPATIBLE" });
    if (!apply) return console.log(`Dry run only. To apply: --apply --schema-sha256=${hash}`);
    if (given !== hash) throw Object.assign(new Error("hash"), { code: "HASH" });
    await q(sql); // file wraps everything in BEGIN/COMMIT; any failure rolls back
    const after = evaluateSchema(await q(COLUMNS_SQL));
    console.log(`applied; post-check: ${after.state}`);
    if (after.state !== "compatible") process.exitCode = 1;
  });
} catch (e) {
  const code = (e as { code?: string }).code;
  console.error(
    code === "INCOMPATIBLE"
      ? "Aborted: existing devrescue tables are incompatible. Nothing was changed."
      : code === "HASH"
        ? "Aborted: --schema-sha256 does not match the reviewed schema file. Nothing was changed."
        : `Aborted: ${describeDbError(e)}. Nothing was changed.`,
  );
  process.exit(1);
}
