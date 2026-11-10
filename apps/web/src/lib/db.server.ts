// Server-only PostgreSQL adapter. Credentials come from server secrets; TLS is always verified.
import pg from "pg";
import { COLUMNS_SQL, evaluateSchema } from "./schema-check";
import { classifyDbError, DIAGNOSES, type DbErrorKind } from "./db-diagnosis";

export const EXPECTED_HOST = "rg-db-wallmarket.postgres.database.azure.com";
export type DbConfigState =
  { ok: true; config: pg.ClientConfig } | { ok: false; missing: string[]; error?: string };

/** Pure: builds a client config from env values. Strips URL ssl params so they cannot weaken TLS. */
export function buildDbConfig(
  env: { DATABASE_URL?: string | undefined; PGSSLROOTCERT_PEM?: string | undefined },
  name = "DATABASE_URL",
): DbConfigState {
  if (!env.DATABASE_URL) return { ok: false, missing: [name] };
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    return { ok: false, missing: [], error: `${name} is not a valid URL` };
  }
  if (!/^postgres(ql)?:$/.test(url.protocol))
    return { ok: false, missing: [], error: `${name} must be postgres://` };
  if (url.hostname !== EXPECTED_HOST)
    return { ok: false, missing: [], error: `${name} host must be ${EXPECTED_HOST}` };
  for (const k of ["sslmode", "ssl", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"])
    url.searchParams.delete(k);
  const ca = env.PGSSLROOTCERT_PEM?.includes("BEGIN CERTIFICATE")
    ? env.PGSSLROOTCERT_PEM
    : undefined;
  return {
    ok: true,
    config: {
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: true, servername: url.hostname, ...(ca ? { ca } : {}) },
      connectionTimeoutMillis: 8000,
      statement_timeout: 5000,
      query_timeout: 6000,
      application_name: "devrescue",
    },
  };
}

export function readDbConfig() {
  return buildDbConfig({
    DATABASE_URL: process.env["DATABASE_URL"],
    PGSSLROOTCERT_PEM: process.env["PGSSLROOTCERT_PEM"],
  });
}

export type Q = <T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  values?: unknown[],
) => Promise<T[]>;

/** One short-lived connection per call (edge runtimes cannot share sockets across requests). */
export async function withDbConfig<T>(
  config: pg.ClientConfig,
  fn: (q: Q) => Promise<T>,
): Promise<T> {
  const client = new pg.Client(config);
  client.on("error", () => console.error("devrescue: database connection error"));
  try {
    await client.connect(); // inside try: a failed connect still gets end() below
    return await fn(async (text, values) => (await client.query(text, values)).rows);
  } finally {
    await client.end().catch(() => {});
  }
}
export async function withDb<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  const cfg = readDbConfig();
  if (!cfg.ok) throw new Error("Database not configured");
  return withDbConfig(cfg.config, fn);
}

export type DbState =
  | "not_configured"
  | "misconfigured"
  | "unreachable"
  | "schema_missing"
  | "schema_incompatible"
  | "ready";
export type Probe = { state: DbState; missing: string[]; detail?: string; kind?: DbErrorKind };

export function describeDbError(e: unknown) {
  return DIAGNOSES[classifyDbError(e)].short;
}

/** Probe runs SELECT 1 + schema preflight on the given query fn. */
export async function probeWith(q: Q): Promise<Probe> {
  const [one] = await q<{ ok: number }>("SELECT 1 AS ok");
  if (Number(one?.ok) !== 1) return { state: "unreachable", missing: [] };
  const v = evaluateSchema(await q<{ table_name: string; column_name: string }>(COLUMNS_SQL));
  if (v.state === "absent") return { state: "schema_missing", missing: [] };
  if (v.state === "incompatible")
    return { state: "schema_incompatible", missing: [], detail: v.problems.join("; ") };
  return { state: "ready", missing: [] };
}

// Ad-hoc, best-effort per-instance cache: unauthenticated status checks share one probe per
// PROBE_TTL_MS and concurrent callers share one in-flight probe, bounding DB connections.
export const PROBE_TTL_MS = 30_000;
let cached: { at: number; value: Probe } | null = null;
let inflight: Promise<Probe> | null = null;
export function resetProbeCache() {
  cached = null;
  inflight = null;
}
export async function probeDb(now = Date.now()): Promise<Probe> {
  const cfg = readDbConfig();
  if (!cfg.ok)
    return cfg.missing.length
      ? { state: "not_configured", missing: cfg.missing }
      : { state: "misconfigured", missing: [], detail: cfg.error ?? "" };
  if (cached && now - cached.at < PROBE_TTL_MS) return cached.value;
  inflight ??= withDbConfig(cfg.config, probeWith)
    .catch((e): Probe => {
      console.error("devrescue: database probe failed");
      const kind = classifyDbError(e);
      return { state: "unreachable", missing: [], kind, detail: DIAGNOSES[kind].short };
    })
    .then((value) => {
      cached = { at: Date.now(), value };
      inflight = null;
      return value;
    });
  return inflight;
}
