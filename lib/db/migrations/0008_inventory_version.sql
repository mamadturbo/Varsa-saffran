ALTER TABLE inventory ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;
ALTER TABLE inventory_reservations ADD COLUMN IF NOT EXISTS generation integer NOT NULL DEFAULT 0;
