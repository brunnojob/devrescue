// Pure, client-safe: maps a database connection failure to a category and safe next steps.
// Only error codes and fixed patterns are inspected; raw messages are never returned, since
// they can contain user names, hosts or IPs.
export type DbErrorKind =
  | "timeout"
  | "dns"
  | "refused"
  | "auth"
  | "tls"
  | "database_missing"
  | "permission"
  | "too_many_connections"
  | "other";

export function classifyDbError(e: unknown): DbErrorKind {
  const code = String((e as { code?: unknown } | null)?.code ?? "");
  const msg = String((e as { message?: unknown } | null)?.message ?? "");
  if (code === "28P01" || code === "28000") return "auth";
  if (code === "3D000") return "database_missing";
  if (code === "42501") return "permission";
  if (code === "53300") return "too_many_connections";
  if (
    /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|DEPTH_ZERO|ALTNAME/i.test(code) ||
    /certificate|self[- ]signed/i.test(msg)
  )
    return "tls";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "dns";
  if (code === "ECONNREFUSED" || code === "ECONNRESET") return "refused";
  if (code === "ETIMEDOUT" || /timeout|timed out/i.test(msg)) return "timeout";
  return "other";
}

export interface Diagnosis {
  title: string;
  short: string;
  cause: string;
  steps: string[];
}

const SECRET_STEP =
  "Update the value in Lovable: project name (top left) → Settings → Secrets. Never paste it in chat.";

export const DIAGNOSES: Record<DbErrorKind, Diagnosis> = {
  timeout: {
    title: "Network timeout",
    short: "network unreachable (check Azure firewall rules)",
    cause:
      "The server address resolved, but nothing answered on port 5432. No login was attempted.",
    steps: [
      "In the Azure portal open the PostgreSQL server → Networking and make sure public access is enabled.",
      "Add a firewall rule that allows the app's servers to connect (their addresses are not fixed).",
      "Wait a minute after saving the rule, then press Recheck.",
    ],
  },
  dns: {
    title: "Server name not found",
    short: "server name could not be resolved",
    cause: "The host name in the connection setting does not resolve to an address.",
    steps: ["Check the server still exists in the Azure portal.", SECRET_STEP],
  },
  refused: {
    title: "Connection refused",
    short: "connection refused",
    cause:
      "The server rejected the connection before login — usually wrong port or the server is stopped.",
    steps: [
      "Check the server is running (Azure portal → Overview).",
      "Confirm the port is 5432.",
      SECRET_STEP,
    ],
  },
  auth: {
    title: "Authentication failed",
    short: "authentication failed",
    cause: "The server was reached and TLS worked, but the user name or password was rejected.",
    steps: [
      "Reset the password for the database login in the Azure portal (or create a dedicated app login).",
      "Make sure special characters in the password are URL-encoded in the connection setting (e.g. @ → %40).",
      SECRET_STEP,
    ],
  },
  tls: {
    title: "Certificate check failed",
    short: "TLS certificate verification failed",
    cause:
      "The server's certificate could not be verified. The connection was stopped on purpose — verification is never turned off.",
    steps: [
      "Confirm the host is the Azure server name, not an IP address or alias.",
      "If your server uses a private certificate authority, add its certificate as the PGSSLROOTCERT_PEM secret.",
      SECRET_STEP,
    ],
  },
  database_missing: {
    title: "Database not found",
    short: "database does not exist",
    cause: "Login worked, but the database named in the connection setting does not exist.",
    steps: ["Check the database name at the end of the connection setting.", SECRET_STEP],
  },
  permission: {
    title: "Permission denied",
    short: "permission denied",
    cause: "The login works but lacks access to the devrescue tables.",
    steps: [
      "Grant the app login USAGE on schema devrescue and table access, as listed at the end of the schema file.",
    ],
  },
  too_many_connections: {
    title: "Too many connections",
    short: "server has too many connections",
    cause: "The database refused a new connection because its limit is reached.",
    steps: [
      "Wait and press Recheck.",
      "Check for other apps holding connections in the Azure portal → Monitoring.",
    ],
  },
  other: {
    title: "Connection failed",
    short: "connection failed",
    cause: "An unexpected error occurred. Details are kept out of the browser for safety.",
    steps: ["Press Recheck in a minute.", "Check the server's health in the Azure portal."],
  },
};
