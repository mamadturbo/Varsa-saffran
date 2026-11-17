BEGIN;
CREATE TABLE IF NOT EXISTS admin_accounts (
 id uuid PRIMARY KEY, username text NOT NULL UNIQUE,
 password_hash text NOT NULL, totp_secret text, pending_secret text,
 pending_until timestamptz, last_counter bigint NOT NULL DEFAULT -1,
 recovery_hashes jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash text PRIMARY KEY, admin_id uuid NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
 complete boolean NOT NULL DEFAULT false, expires_at timestamptz NOT NULL,
 last_seen timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_sessions_account ON admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS security_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, admin_id uuid,
 event text NOT NULL, route text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS security_limits (
 bucket text PRIMARY KEY, attempts integer NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS security_limits_expiry ON security_limits(expires_at);
CREATE TABLE IF NOT EXISTS security_storage_lock(id integer PRIMARY KEY CHECK(id=1));
INSERT INTO security_storage_lock VALUES(1) ON CONFLICT DO NOTHING;
CREATE INDEX IF NOT EXISTS stored_files_owner ON stored_files(owner_id);
REVOKE ALL ON security_storage_lock FROM PUBLIC;
REVOKE ALL ON admin_accounts,admin_sessions,security_audit,security_limits FROM PUBLIC;
REVOKE ALL ON SEQUENCE security_audit_id_seq FROM PUBLIC;
-- Hosted PostgreSQL may have default grants directly to browser roles.
-- Revoking PUBLIC alone does not remove those grants.
DO $$ DECLARE tab text; browser_role text; BEGIN
 FOREACH browser_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=browser_role) THEN
   FOREACH tab IN ARRAY ARRAY['admin_accounts','admin_sessions','security_audit','security_limits','security_storage_lock'] LOOP
    EXECUTE format('REVOKE ALL ON %I FROM %I',tab,browser_role);
   END LOOP;
   EXECUTE format('REVOKE ALL ON SEQUENCE security_audit_id_seq FROM %I',browser_role);
  END IF;
 END LOOP;
END $$;
COMMIT;
