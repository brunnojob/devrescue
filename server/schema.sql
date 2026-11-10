-- Run explicitly using a dedicated database and migration role.
-- Never run against existing Wallmarket tables.
CREATE SCHEMA IF NOT EXISTS devrescue;
CREATE TABLE IF NOT EXISTS devrescue.reports (
  id uuid PRIMARY KEY,
  owner_id varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  report jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_owner_created ON devrescue.reports(owner_id, created_at DESC);
-- Grant only USAGE on this schema and SELECT/INSERT/DELETE on reports to the runtime role.
