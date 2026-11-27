CREATE TABLE IF NOT EXISTS drive_items (
  id text PRIMARY KEY,
  scope_kind text NOT NULL CHECK (scope_kind IN ('org', 'user', 'project', 'project-user', 'captain', 'automation')),
  scope_id text NOT NULL,
  parent_id text REFERENCES drive_items(id) ON DELETE CASCADE,
  path text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('file', 'folder')),
  blob_sha256 text,
  size bigint NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 0,
  mount_into_threads boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_kind, scope_id, path)
);
CREATE INDEX IF NOT EXISTS drive_items_parent_idx ON drive_items (scope_kind, scope_id, parent_id);

CREATE TABLE IF NOT EXISTS drive_versions (
  item_id text NOT NULL REFERENCES drive_items(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  sha256 text NOT NULL,
  size bigint NOT NULL,
  by text NOT NULL,
  source text NOT NULL CHECK (source IN ('upload', 'agent', 'restore')),
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, version)
);
