BEGIN;
CREATE TABLE IF NOT EXISTS card_transfer_receipts (
 id text PRIMARY KEY, order_id integer NOT NULL REFERENCES orders(id),
 object_key text NOT NULL UNIQUE, sha256 text NOT NULL, size integer NOT NULL CHECK(size>0),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 amount integer NOT NULL CHECK(amount>=0), destination jsonb NOT NULL,
 reviewed_by text, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS card_receipts_order_idx ON card_transfer_receipts(order_id,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS card_receipts_pending_idx ON card_transfer_receipts(order_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS card_receipts_sha_idx ON card_transfer_receipts(sha256);
CREATE TABLE IF NOT EXISTS bale_bot_state (id text PRIMARY KEY, next_offset integer NOT NULL DEFAULT 0);
INSERT INTO bale_bot_state(id) VALUES('main') ON CONFLICT DO NOTHING;
REVOKE ALL ON card_transfer_receipts,bale_bot_state FROM PUBLIC;
DO $$ DECLARE browser_role text; BEGIN
 FOREACH browser_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=browser_role) THEN
   EXECUTE format('REVOKE ALL ON card_transfer_receipts,bale_bot_state FROM %I',browser_role);
  END IF;
 END LOOP;
END $$;
COMMIT;
