CREATE TABLE IF NOT EXISTS automations (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  prompt text NOT NULL,
  triggers jsonb NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_when text,
  gate_model jsonb NOT NULL DEFAULT '{"adapter":"fake","model":"free-fast"}'::jsonb,
  model jsonb NOT NULL DEFAULT '{"name":null,"pinned":false}'::jsonb,
  thread_mode text NOT NULL DEFAULT 'new' CHECK (thread_mode IN ('new','standing','existing','private')),
  existing_thread_id text REFERENCES threads(id) ON DELETE SET NULL,
  standing_thread_id text REFERENCES threads(id) ON DELETE SET NULL,
  webhook_hash text UNIQUE,
  machine_size text NOT NULL DEFAULT 'small',
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','paused','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (jsonb_array_length(triggers) BETWEEN 1 AND 20)
);
CREATE TABLE IF NOT EXISTS automation_runs (
  id text PRIMARY KEY,
  automation_id text NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  trigger_type text NOT NULL CHECK (trigger_type IN ('schedule','github','webhook','manual')),
  trigger_key text NOT NULL,
  idempotency_key text,
  status text NOT NULL CHECK (status IN ('queued','running','completed','failed','skipped','duplicate','cancelled')),
  thread_id text REFERENCES threads(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  skip_reason text,
  dispatched_at timestamptz,
  dispatch_attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (automation_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS automation_batches (
  id text PRIMARY KEY,
  automation_id text NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','flushed','cancelled')),
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
