BEGIN;

CREATE TABLE IF NOT EXISTS customer_contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 phone varchar(11) NOT NULL UNIQUE,
 CONSTRAINT customer_contacts_mobile_check CHECK(phone ~ '^09[0-9]{9}$')
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_contact_id uuid REFERENCES customer_contacts(id);
CREATE INDEX IF NOT EXISTS orders_contact_history_idx ON orders(customer_contact_id,created_at DESC,id DESC);

CREATE TABLE IF NOT EXISTS customer_followups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contact_id uuid NOT NULL REFERENCES customer_contacts(id),
 text text NOT NULL CHECK(length(btrim(text)) BETWEEN 1 AND 2000),
 created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 due_at timestamptz,
 completed_at timestamptz,
 CHECK(completed_at IS NULL OR due_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS customer_followups_contact_idx ON customer_followups(contact_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS customer_followups_due_idx ON customer_followups(due_at,id)
 WHERE due_at IS NOT NULL AND completed_at IS NULL;

CREATE TABLE IF NOT EXISTS shipments (
 order_id integer PRIMARY KEY REFERENCES orders(id),
 carrier text CHECK(carrier IS NULL OR length(btrim(carrier)) BETWEEN 1 AND 100),
 tracking_code text CHECK(tracking_code IS NULL OR length(btrim(tracking_code)) BETWEEN 1 AND 100),
 shipped_at timestamptz,
 delivered_at timestamptz,
 CHECK(delivered_at IS NULL OR shipped_at IS NULL OR delivered_at >= shipped_at)
);
CREATE TABLE IF NOT EXISTS order_events (
 id serial PRIMARY KEY,
 order_id integer NOT NULL REFERENCES orders(id),
 kind text NOT NULL CHECK(kind IN ('order_created','status_changed','receipt_submitted','receipt_reviewed','shipment_updated')),
 value text,
 actor text NOT NULL,
 event_key text UNIQUE,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events(order_id,occurred_at,id);

-- Match checkout's Iranian mobile formats while preserving the original order text.
CREATE TEMP TABLE tracking_migration_contacts ON COMMIT DROP AS
WITH cleaned AS (
 SELECT id,regexp_replace(
   translate(phone, U&'۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF',
     '01234567890123456789'),
   '[[:space:]-]', '', 'g') AS mobile
 FROM orders WHERE customer_contact_id IS NULL AND length(phone) <= 64
)
SELECT id, CASE
 WHEN mobile ~ '^09[0-9]{9}$' THEN mobile
 WHEN mobile ~ '^\+989[0-9]{9}$' THEN '0' || substr(mobile,4)
 WHEN mobile ~ '^00989[0-9]{9}$' THEN '0' || substr(mobile,5)
END AS phone FROM cleaned;
INSERT INTO customer_contacts(phone)
 SELECT DISTINCT phone FROM tracking_migration_contacts WHERE phone IS NOT NULL
 ON CONFLICT(phone) DO NOTHING;
UPDATE orders o SET customer_contact_id=c.id
 FROM tracking_migration_contacts m JOIN customer_contacts c ON c.phone=m.phone
 WHERE o.id=m.id AND o.customer_contact_id IS NULL;

INSERT INTO order_events(order_id,kind,actor,event_key,occurred_at)
 SELECT id,'order_created','system:legacy','created:' || id,created_at FROM orders
 ON CONFLICT(event_key) DO NOTHING;
INSERT INTO order_events(order_id,kind,value,actor,event_key,occurred_at)
 SELECT order_id,'receipt_submitted',NULL,'system:legacy','receipt-submitted:' || id,created_at
 FROM card_transfer_receipts ON CONFLICT(event_key) DO NOTHING;
INSERT INTO order_events(order_id,kind,value,actor,event_key,occurred_at)
 SELECT order_id,'receipt_reviewed',status,coalesce(reviewed_by,'system:legacy'),'receipt-reviewed:' || id,reviewed_at
 FROM card_transfer_receipts WHERE reviewed_at IS NOT NULL AND status IN ('approved','rejected')
 ON CONFLICT(event_key) DO NOTHING;

-- Accept timestamps written by the old ISO timestamp writer. Keep unknown dates null.
CREATE FUNCTION pg_temp.tracking_iso_time(value text) RETURNS timestamptz
LANGUAGE plpgsql STRICT AS $$
BEGIN
  IF value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?Z$' THEN
    RETURN value::timestamptz;
  END IF;
  RETURN NULL;
EXCEPTION
  WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN NULL;
END
$$;
WITH legacy AS (
 SELECT o.id,o.status,coalesce(d.meta,s.payload->'orderMeta'->(o.id::text)) AS meta
 FROM orders o LEFT JOIN order_details d ON d.order_id=o.id
 LEFT JOIN store_management s ON s.id='main' AND d.order_id IS NULL
), known AS (
 SELECT id,status,
 CASE WHEN length(btrim(meta->>'trackingCode')) BETWEEN 1 AND 100 THEN btrim(meta->>'trackingCode') END AS tracking_code,
 pg_temp.tracking_iso_time(meta->>'shippedAt') AS shipped_at,
 pg_temp.tracking_iso_time(meta->>'deliveredAt') AS delivered_at
 FROM legacy
)
INSERT INTO shipments(order_id,tracking_code,shipped_at,delivered_at)
 SELECT id,tracking_code,CASE WHEN shipped_at <= delivered_at OR delivered_at IS NULL THEN shipped_at END,delivered_at
 FROM known WHERE tracking_code IS NOT NULL OR shipped_at IS NOT NULL OR delivered_at IS NOT NULL OR status IN ('shipped','delivered')
 ON CONFLICT(order_id) DO NOTHING;
DROP FUNCTION pg_temp.tracking_iso_time(text);

REVOKE ALL ON customer_contacts,customer_followups,shipments,order_events FROM PUBLIC;
DO $$ DECLARE browser_role text; BEGIN
 FOREACH browser_role IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=browser_role) THEN
     EXECUTE format('REVOKE ALL ON customer_contacts,customer_followups,shipments,order_events FROM %I',browser_role);
   END IF;
 END LOOP;
END $$;
COMMIT;
