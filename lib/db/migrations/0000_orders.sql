CREATE TABLE IF NOT EXISTS orders (
 id serial PRIMARY KEY, order_number varchar(32) NOT NULL UNIQUE,
 customer_name varchar(120) NOT NULL, phone varchar(32) NOT NULL, address text NOT NULL,
 items jsonb NOT NULL, total integer NOT NULL CHECK(total >= 0),
 status varchar(20) NOT NULL DEFAULT 'pending',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);
