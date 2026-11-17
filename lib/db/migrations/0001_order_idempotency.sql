BEGIN;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key varchar(36);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS request_fingerprint varchar(64);
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_unique ON orders (idempotency_key);
COMMIT;
