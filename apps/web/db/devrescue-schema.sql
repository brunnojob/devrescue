-- DevRescue isolated schema. REVIEW BEFORE RUNNING. Never applied automatically.
-- Apply only with: bun scripts/migrate-devrescue.ts --apply --schema-sha256=<hash printed by dry run>
-- Touches only the `devrescue` schema. No IF NOT EXISTS on tables: a pre-existing table with
-- different columns (e.g. the old owner_id layout) must fail loudly, never be silently accepted.
BEGIN;
CREATE SCHEMA IF NOT EXISTS devrescue;

CREATE TABLE devrescue.users (
  id uuid PRIMARY KEY,
  email varchar(254) NOT NULL,
  password_hash varchar(200) NOT NULL,
  failed_logins integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  report_count integer NOT NULL DEFAULT 0 CHECK (report_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_lower CHECK (email = lower(email))
);
CREATE UNIQUE INDEX users_email_key ON devrescue.users (email);

CREATE TABLE devrescue.sessions (
  token_hash char(64) PRIMARY KEY,           -- sha256 hex of the cookie token; raw token never stored
  user_id uuid NOT NULL REFERENCES devrescue.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user ON devrescue.sessions (user_id);
CREATE INDEX sessions_expires ON devrescue.sessions (expires_at);

CREATE TABLE devrescue.reports (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES devrescue.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  report jsonb NOT NULL,
  CONSTRAINT reports_size CHECK (pg_column_size(report) <= 65536)
);
CREATE INDEX reports_user_created ON devrescue.reports (user_id, created_at DESC);

-- Least-privilege runtime role (create separately with its own password, then):
-- GRANT USAGE ON SCHEMA devrescue TO devrescue_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON devrescue.users, devrescue.sessions, devrescue.reports TO devrescue_app;
COMMIT;
