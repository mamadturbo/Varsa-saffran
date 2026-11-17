DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='orders'::regclass AND conname='orders_valid_status') THEN
   ALTER TABLE orders ADD CONSTRAINT orders_valid_status CHECK(status IN ('pending','confirmed','processing','shipped','delivered','cancelled')) NOT VALID;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='orders'::regclass AND conname='orders_nonnegative_total') THEN
   ALTER TABLE orders ADD CONSTRAINT orders_nonnegative_total CHECK(total>=0) NOT VALID;
 END IF;
END $$;
ALTER TABLE orders VALIDATE CONSTRAINT orders_valid_status;
ALTER TABLE orders VALIDATE CONSTRAINT orders_nonnegative_total;
