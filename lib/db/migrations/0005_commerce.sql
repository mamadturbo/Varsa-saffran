BEGIN;
CREATE TABLE IF NOT EXISTS commerce_products(id text PRIMARY KEY, name text NOT NULL, attributes jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS product_variants(
 id text PRIMARY KEY, product_id text NOT NULL REFERENCES commerce_products(id), sku text NOT NULL UNIQUE,
 slug text NOT NULL UNIQUE, name text NOT NULL, price integer NOT NULL CHECK(price >= 0),
 currency text NOT NULL DEFAULT 'IRT' CHECK(currency='IRT'), weight_mg integer NOT NULL CHECK(weight_mg > 0),
 active boolean NOT NULL, display jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS product_variants_parent_idx ON product_variants(product_id);
CREATE TABLE IF NOT EXISTS inventory(variant_id text PRIMARY KEY REFERENCES product_variants(id), available integer CHECK(available IS NULL OR available >= 0));
CREATE TABLE IF NOT EXISTS coupons(id text PRIMARY KEY, code text NOT NULL UNIQUE, kind text NOT NULL CHECK(kind IN ('fixed','percent')),
 value integer NOT NULL CHECK(value>0), minimum integer NOT NULL CHECK(minimum>=0), usage_limit integer NOT NULL CHECK(usage_limit>=0),
 used integer NOT NULL CHECK(used>=0), expires_at text NOT NULL, active boolean NOT NULL,
 CHECK(kind <> 'percent' OR value<=100));
CREATE TABLE IF NOT EXISTS order_details(order_id integer PRIMARY KEY REFERENCES orders(id), meta jsonb NOT NULL,
 currency text NOT NULL DEFAULT 'IRT' CHECK(currency='IRT'), payment_status text NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','paid','refunded')),
 payment_method text NOT NULL DEFAULT 'manual', fulfillment_status text NOT NULL DEFAULT 'unfulfilled' CHECK(fulfillment_status IN ('unfulfilled','shipped','delivered')),
 address_snapshot jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS order_items(id serial PRIMARY KEY, order_id integer NOT NULL REFERENCES orders(id), variant_id text,
 snapshot jsonb NOT NULL, quantity integer NOT NULL CHECK(quantity>0), unit_price integer NOT NULL CHECK(unit_price>=0), UNIQUE(order_id,variant_id));
CREATE TABLE IF NOT EXISTS inventory_reservations(id serial PRIMARY KEY, order_id integer NOT NULL REFERENCES orders(id),
 variant_id text NOT NULL REFERENCES product_variants(id), quantity integer NOT NULL CHECK(quantity>0),
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','released','committed')), expires_at timestamptz NOT NULL, UNIQUE(order_id,variant_id));
CREATE INDEX IF NOT EXISTS reservation_expiry_idx ON inventory_reservations(state,expires_at);
CREATE TABLE IF NOT EXISTS inventory_movements(id serial PRIMARY KEY, variant_id text NOT NULL REFERENCES product_variants(id),
 order_id integer REFERENCES orders(id), delta integer NOT NULL, reason text NOT NULL, event_key text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS inventory_movements_variant_idx ON inventory_movements(variant_id,created_at);
CREATE TABLE IF NOT EXISTS coupon_redemptions(order_id integer PRIMARY KEY REFERENCES orders(id), coupon_id text NOT NULL REFERENCES coupons(id), discount integer NOT NULL CHECK(discount>=0));
CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_idx ON coupon_redemptions(coupon_id);
CREATE TABLE IF NOT EXISTS content_entries(id text PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('article','banner')), slug text,
 payload jsonb NOT NULL, UNIQUE(kind,slug));
CREATE INDEX IF NOT EXISTS content_kind_idx ON content_entries(kind);
CREATE TABLE IF NOT EXISTS store_config(id text PRIMARY KEY, revision integer NOT NULL DEFAULT 0, settings jsonb NOT NULL,
 articles_imported boolean NOT NULL DEFAULT false, articles_initialized boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS outbox(id text PRIMARY KEY, kind text NOT NULL, payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), available_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz, lease_token text, last_error text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS outbox_claim_idx ON outbox(status,available_at);
CREATE INDEX IF NOT EXISTS outbox_lease_idx ON outbox(lease_until) WHERE status='processing';
CREATE TABLE IF NOT EXISTS stored_files(id text PRIMARY KEY, owner_id text REFERENCES customers(id), visibility text NOT NULL,
 object_key text NOT NULL UNIQUE, mime text NOT NULL, size integer NOT NULL CHECK(size>0), sha256 text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), CHECK((visibility='public' AND owner_id IS NULL) OR (visibility='private' AND owner_id IS NOT NULL)));
CREATE TABLE IF NOT EXISTS contact_messages_api(id serial PRIMARY KEY, name text NOT NULL, phone text NOT NULL, subject text NOT NULL,
 message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
-- No gateway is active. Multiple attempts may reference a single order in a future adapter.
CREATE TABLE IF NOT EXISTS payment_attempts(id text PRIMARY KEY, order_id integer NOT NULL REFERENCES orders(id),
 provider text NOT NULL, provider_reference text UNIQUE, status text NOT NULL CHECK(status IN ('pending','succeeded','failed')),
 amount integer NOT NULL CHECK(amount>=0), currency text NOT NULL CHECK(currency IN ('IRT','IRR')), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS payment_attempts_order_idx ON payment_attempts(order_id);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['commerce_products','product_variants','inventory','coupons','order_details','order_items','inventory_reservations',
 'inventory_movements','coupon_redemptions','content_entries','store_config','outbox','stored_files','contact_messages_api','payment_attempts'] LOOP
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',tab);
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON %I FROM anon',tab); END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON %I FROM authenticated',tab); END IF;
 END LOOP;
END $$;
COMMIT;
