export const ACCESS_COLUMNS = {
  github_access: [
    "github_id",
    "user_id",
    "github_login",
    "connection_ciphertext",
    "trial_started_at",
    "monthly_active",
    "one_time_confirmed",
    "checked_at",
    "created_at",
  ],
  github_oauth_pending: ["user_id", "nonce_hash", "session_hash", "expires_at"],
};
export function accessSchemaState(rows: { table_name: string; column_name: string }[]) {
  const present = Object.keys(ACCESS_COLUMNS).filter((t) => rows.some((r) => r.table_name === t));
  if (!present.length) return "absent";
  return Object.entries(ACCESS_COLUMNS).every(([t, cols]) =>
    cols.every((c) => rows.some((r) => r.table_name === t && r.column_name === c)),
  )
    ? "compatible"
    : "incompatible";
}
