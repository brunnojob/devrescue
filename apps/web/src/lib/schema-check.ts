// Pure: compares live devrescue columns against what this app requires.
export const REQUIRED: Record<string, string[]> = {
  users: [
    "id",
    "email",
    "password_hash",
    "failed_logins",
    "locked_until",
    "report_count",
    "created_at",
  ],
  sessions: ["token_hash", "user_id", "created_at", "expires_at"],
  reports: ["id", "user_id", "created_at", "report"],
};
export type SchemaVerdict = { state: "absent" | "compatible" | "incompatible"; problems: string[] };
export const COLUMNS_SQL =
  "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'devrescue'";

export function evaluateSchema(rows: { table_name: string; column_name: string }[]): SchemaVerdict {
  const live = new Map<string, Set<string>>();
  for (const r of rows)
    (live.get(r.table_name) ?? live.set(r.table_name, new Set()).get(r.table_name)!).add(
      r.column_name,
    );
  const ours = Object.keys(REQUIRED).filter((t) => live.has(t));
  if (!ours.length) return { state: "absent", problems: [] };
  const problems: string[] = [];
  for (const [t, cols] of Object.entries(REQUIRED)) {
    const have = live.get(t);
    if (!have) {
      problems.push(`devrescue.${t} is missing`);
      continue;
    }
    const miss = cols.filter((c) => !have.has(c));
    if (miss.length) problems.push(`devrescue.${t} lacks column(s): ${miss.join(", ")}`);
  }
  if (live.get("reports")?.has("owner_id"))
    problems.unshift(
      "devrescue.reports uses the old public-repo layout (owner_id, API-token owner). It is not compatible with per-user accounts; migrate or rename it manually — this tool never drops data.",
    );
  return problems.length
    ? { state: "incompatible", problems }
    : { state: "compatible", problems: [] };
}
