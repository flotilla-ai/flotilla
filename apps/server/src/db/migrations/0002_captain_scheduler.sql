CREATE TABLE IF NOT EXISTS captain_wakes (
  id text PRIMARY KEY,
  captain_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('event', 'heartbeat')),
  due_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  idle_cycles integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS captain_scheduler_state (
  captain_id text PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
  last_event_at timestamptz NOT NULL DEFAULT 'epoch',
  last_wake_at timestamptz
);
