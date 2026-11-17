BEGIN;
CREATE TABLE IF NOT EXISTS customer_addresses(
 customer_id text NOT NULL REFERENCES customers(id), id text NOT NULL, is_default boolean NOT NULL DEFAULT false,
 payload jsonb NOT NULL, PRIMARY KEY(customer_id,id));
CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_default_idx ON customer_addresses(customer_id) WHERE is_default;
CREATE TABLE IF NOT EXISTS customer_favorites(
 customer_id text NOT NULL REFERENCES customers(id), variant_id text NOT NULL REFERENCES product_variants(id), PRIMARY KEY(customer_id,variant_id));
CREATE INDEX IF NOT EXISTS customer_favorites_variant_idx ON customer_favorites(variant_id);
CREATE TABLE IF NOT EXISTS case_messages(
 id text PRIMARY KEY, case_id text NOT NULL REFERENCES customer_cases(id), author text NOT NULL CHECK(author IN ('customer','admin')),
 body text NOT NULL, attachments jsonb NOT NULL, created_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS case_messages_case_idx ON case_messages(case_id,created_at,id);
CREATE INDEX IF NOT EXISTS stored_files_owner_idx ON stored_files(owner_id);
CREATE INDEX IF NOT EXISTS inventory_reservations_variant_idx ON inventory_reservations(variant_id);
CREATE INDEX IF NOT EXISTS customer_cases_order_idx ON customer_cases(order_id);
CREATE INDEX IF NOT EXISTS customer_sessions_customer_idx ON customer_sessions(customer_id);
CREATE INDEX IF NOT EXISTS inventory_movements_order_idx ON inventory_movements(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS customer_cases_open_request_idx ON customer_cases(customer_id,order_id,kind)
 WHERE kind IN ('cancel','return') AND status NOT IN ('closed','rejected');
REVOKE ALL ON customer_addresses,customer_favorites,case_messages FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON customer_addresses,customer_favorites,case_messages FROM %I',role_name);END IF;
 END LOOP;
END $$;
COMMIT;
