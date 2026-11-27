CREATE TABLE IF NOT EXISTS model_policies (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  run_out text NOT NULL DEFAULT 'ask' CHECK (run_out IN ('ask', 'ask-before-free', 'keep-going')),
  never_free boolean NOT NULL DEFAULT false,
  excluded_adapters jsonb NOT NULL DEFAULT '[]',
  background jsonb
);

ALTER TABLE approvals DROP CONSTRAINT IF EXISTS approvals_kind_check;
ALTER TABLE approvals ADD CONSTRAINT approvals_kind_check CHECK (kind IN ('conversation', 'decision', 'budget', 'merge', 'environment', 'mcp', 'credential', 'machine', 'hook-change', 'run-out'));
ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_state_check;
ALTER TABLE runs ADD CONSTRAINT runs_state_check CHECK (state IN ('starting', 'running', 'completed', 'cancelled', 'failed', 'paused_budget', 'run_out'));
