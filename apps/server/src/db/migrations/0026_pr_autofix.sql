ALTER TABLE prs
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS author text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS draft boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checks_state text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS pushed_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_ci_wake_at timestamptz;
CREATE TABLE IF NOT EXISTS pull_request_settings (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  branch_prefix text NOT NULL DEFAULT 'flotilla',
  draft_default boolean NOT NULL DEFAULT false,
  open_in_flotilla boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
