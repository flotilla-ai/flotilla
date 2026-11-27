CREATE TABLE IF NOT EXISTS machine_cleanups (
  thread_id text PRIMARY KEY,
  container_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
