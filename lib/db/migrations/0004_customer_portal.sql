BEGIN;
CREATE TABLE IF NOT EXISTS customers (id text PRIMARY KEY, phone text NOT NULL UNIQUE, profile jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS customer_sessions (token_hash text PRIMARY KEY, customer_id text NOT NULL REFERENCES customers(id), expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS customer_sessions_expiry_idx ON customer_sessions(expires_at);
CREATE TABLE IF NOT EXISTS customer_otps (phone text PRIMARY KEY, digest text NOT NULL, attempts integer NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS customer_rate_limits (bucket text PRIMARY KEY, attempts integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS customer_order_links (order_id integer PRIMARY KEY REFERENCES orders(id), customer_id text NOT NULL REFERENCES customers(id));
CREATE INDEX IF NOT EXISTS customer_order_links_customer_idx ON customer_order_links(customer_id);
CREATE TABLE IF NOT EXISTS customer_cases (id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customers(id), order_id integer REFERENCES orders(id), kind text NOT NULL CHECK(kind IN ('ticket','cancel','return')), status text NOT NULL CHECK(status IN ('waiting_admin','waiting_customer','closed','approved','rejected')), payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS customer_cases_customer_idx ON customer_cases(customer_id);
CREATE TABLE IF NOT EXISTS customer_notifications (id serial PRIMARY KEY, customer_id text NOT NULL REFERENCES customers(id), title text NOT NULL, message text NOT NULL, order_id integer, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), sms_status text NOT NULL DEFAULT 'disabled');
CREATE INDEX IF NOT EXISTS customer_notifications_customer_idx ON customer_notifications(customer_id);
ALTER TABLE customer_notifications ADD COLUMN IF NOT EXISTS sms_attempt_at timestamptz;
CREATE TABLE IF NOT EXISTS customer_reviews (id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customers(id), product_id text NOT NULL, rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5), body text NOT NULL, author text NOT NULL, published boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS customer_reviews_owner_product_idx ON customer_reviews(customer_id,product_id);
CREATE INDEX IF NOT EXISTS customer_reviews_product_idx ON customer_reviews(product_id);
CREATE TABLE IF NOT EXISTS customer_media (id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customers(id), mime text NOT NULL, data text NOT NULL);
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['customers','customer_sessions','customer_otps','customer_rate_limits','customer_order_links','customer_cases','customer_notifications','customer_reviews','customer_media'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
    EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',tab);
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON %I FROM anon',tab); END IF;
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON %I FROM authenticated',tab); END IF;
  END LOOP;
END $$;
COMMIT;
