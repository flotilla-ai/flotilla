CREATE TABLE IF NOT EXISTS captain_documents (
  captain_id text NOT NULL REFERENCES captains(thread_id) ON DELETE CASCADE,
  file text NOT NULL,
  content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (captain_id,file)
);
CREATE TABLE IF NOT EXISTS captain_digest_items (
  id text PRIMARY KEY,
  captain_id text NOT NULL REFERENCES captains(thread_id) ON DELETE CASCADE,
  text text NOT NULL,
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','acted','dropped')),
  action jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  acted_at timestamptz
);
CREATE TABLE IF NOT EXISTS captain_rules (
  id text PRIMARY KEY,
  captain_id text NOT NULL REFERENCES captains(thread_id) ON DELETE CASCADE,
  kind text NOT NULL,
  text text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS captain_messages (
  id text PRIMARY KEY,
  from_captain_id text NOT NULL REFERENCES captains(thread_id) ON DELETE CASCADE,
  to_captain_id text NOT NULL REFERENCES captains(thread_id) ON DELETE CASCADE,
  text text NOT NULL,
  suppressed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
