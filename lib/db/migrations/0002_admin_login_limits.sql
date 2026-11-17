BEGIN;
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  bucket varchar(80) PRIMARY KEY,
  attempts integer NOT NULL CHECK (attempts > 0),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_login_attempts_expires_idx ON admin_login_attempts (expires_at);
COMMIT;
