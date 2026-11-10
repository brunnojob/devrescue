-- Additional reviewed migration; never modifies the installed base migration.
-- Run only using scripts/migrate-access.ts --apply --schema-sha256=<reviewed hash>.
BEGIN;
CREATE TABLE devrescue.github_access (
  github_id varchar(32) PRIMARY KEY CHECK (github_id ~ '^[0-9]+$'),
  user_id uuid NOT NULL UNIQUE REFERENCES devrescue.users(id),
  github_login varchar(100) NOT NULL,
  connection_ciphertext text NOT NULL,
  trial_started_at timestamptz,
  monthly_active boolean NOT NULL DEFAULT false,
  one_time_confirmed boolean NOT NULL DEFAULT false,
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- No cascading deletion: deleting/recreating an app account cannot restart a GitHub trial.
CREATE TABLE devrescue.github_oauth_pending (
  user_id uuid PRIMARY KEY REFERENCES devrescue.users(id) ON DELETE CASCADE,
  nonce_hash char(64) NOT NULL,
  session_hash char(64) NOT NULL,
  expires_at timestamptz NOT NULL
);
COMMIT;