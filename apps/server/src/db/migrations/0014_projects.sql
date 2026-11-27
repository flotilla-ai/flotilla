ALTER TABLE projects ALTER COLUMN repo DROP NOT NULL;
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS repos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source jsonb,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS code text CHECK (code ~ '^[A-Z][A-Z0-9]{1,5}$'),
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared')),
  ADD COLUMN IF NOT EXISTS thread_seq integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS projects_code_key ON projects (code);

UPDATE projects SET code = 'P' || upper(substr(md5(id), 1, 5)) WHERE code IS NULL;
UPDATE projects SET repos = jsonb_build_array(jsonb_build_object(
  'id', 'rep_primary', 'provider', COALESCE(repo->>'provider', 'github'), 'fullName', repo->>'fullName',
  'baseBranch', COALESCE(repo->>'baseBranch', 'main'), 'role', 'primary', 'machineId', NULL, 'description', NULL, 'clonedAt', NULL))
WHERE repo ? 'fullName' AND repos = '[]'::jsonb;

CREATE OR REPLACE FUNCTION flotilla_project_thread_code() RETURNS trigger AS $$
DECLARE prefix text; n integer;
BEGIN
  IF NEW.project_id IS NULL THEN RETURN NEW; END IF;
  UPDATE projects SET thread_seq = thread_seq + 1 WHERE id = NEW.project_id AND code IS NOT NULL RETURNING code, thread_seq INTO prefix, n;
  IF prefix IS NOT NULL THEN NEW.code := prefix || '-' || n; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS threads_project_code ON threads;
CREATE TRIGGER threads_project_code BEFORE INSERT ON threads FOR EACH ROW EXECUTE FUNCTION flotilla_project_thread_code();
