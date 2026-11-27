CREATE TABLE IF NOT EXISTS usage_settings (
  id text PRIMARY KEY DEFAULT 'org' CHECK (id = 'org'),
  run_out_free text NOT NULL DEFAULT 'ask' CHECK (run_out_free IN ('ask', 'never')),
  machine_rates jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS usage_budgets (
  scope text NOT NULL CHECK (scope IN ('global', 'project')),
  scope_id text NOT NULL,
  budget_window text NOT NULL CHECK (budget_window IN ('month', 'lifetime')),
  max_usd bigint CHECK (max_usd IS NULL OR max_usd >= 0),
  warn_at real NOT NULL DEFAULT 0.8 CHECK (warn_at > 0 AND warn_at <= 1),
  PRIMARY KEY (scope, scope_id)
);
ALTER TABLE cost_entries ADD COLUMN IF NOT EXISTS owner_id text;
ALTER TABLE cost_entries ADD COLUMN IF NOT EXISTS project_id text;
ALTER TABLE cost_entries ADD COLUMN IF NOT EXISTS connection_id text;
ALTER TABLE cost_entries ADD COLUMN IF NOT EXISTS item text;
ALTER TABLE cost_entries ADD COLUMN IF NOT EXISTS runner_type text;
CREATE INDEX IF NOT EXISTS cost_entries_at_idx ON cost_entries (at);

-- Every ledger row is stamped with who/where/which billing item at insert time, and
-- machine-estimate rows are priced from the operator's per-runner-type rate (µ$/minute).
CREATE OR REPLACE FUNCTION usage_stamp_cost_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t record; rate bigint; conn_kind text;
BEGIN
  SELECT owner_id, project_id, engine->>'connectionId' AS connection_id INTO t FROM threads WHERE id = NEW.thread_id;
  NEW.owner_id := COALESCE(NEW.owner_id, t.owner_id);
  NEW.project_id := COALESCE(NEW.project_id, t.project_id);
  NEW.connection_id := COALESCE(NEW.connection_id, t.connection_id);
  IF NEW.source = 'machine-estimate' THEN
    NEW.runner_type := COALESCE(NEW.runner_type, 'pool');
    NEW.item := 'machine';
    SELECT (machine_rates->>NEW.runner_type)::bigint INTO rate FROM usage_settings WHERE id = 'org';
    IF rate IS NOT NULL AND COALESCE((NEW.delta->>'usd')::bigint, 0) = 0 THEN
      NEW.delta := jsonb_set(NEW.delta, '{usd}', to_jsonb(round(rate * COALESCE((NEW.delta->>'machineSec')::numeric, 0) / 60)::bigint));
    END IF;
  ELSE
    SELECT kind INTO conn_kind FROM model_connections WHERE id = NEW.connection_id;
    NEW.item := COALESCE(NEW.item, CASE WHEN NEW.connection_id = 'free' OR conn_kind = 'free' THEN 'free'
      WHEN conn_kind = 'subscription' THEN 'subscription' WHEN conn_kind IS NOT NULL THEN 'key' ELSE 'unattributed' END);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cost_entries_usage_stamp ON cost_entries;
CREATE TRIGGER cost_entries_usage_stamp BEFORE INSERT ON cost_entries FOR EACH ROW EXECUTE FUNCTION usage_stamp_cost_entry();

UPDATE cost_entries c SET owner_id = t.owner_id, project_id = t.project_id, connection_id = t.engine->>'connectionId',
  item = CASE WHEN c.source = 'machine-estimate' THEN 'machine' ELSE 'unattributed' END,
  runner_type = CASE WHEN c.source = 'machine-estimate' THEN 'pool' END
FROM threads t WHERE t.id = c.thread_id AND c.owner_id IS NULL;
