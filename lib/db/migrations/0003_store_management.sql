BEGIN;
CREATE TABLE IF NOT EXISTS store_management (
  id text PRIMARY KEY,
  payload jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS store_media (
  id text PRIMARY KEY,
  mime text NOT NULL,
  data text NOT NULL
);
-- API-owned tables must not become readable via a Supabase public REST role.
ALTER TABLE store_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_media ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON store_management, store_media FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON store_management, store_media FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON store_management, store_media FROM authenticated';
  END IF;
END $$;
COMMIT;
