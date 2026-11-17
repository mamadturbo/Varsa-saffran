import { migrateTest } from "./commerce-fixture";
import { mountSecurity, secureFetch, loginAdmin } from "./security-fixture";
import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createOrdersRouter } from "../src/lib/orders-router";
import { legacyCatalogFixture } from "./catalog-fixture";

const postgres = new PGlite();
const password = "isolated-workflow-password";
const previous = {
  secret: process.env.SESSION_SECRET,
  password: process.env.VARSA_ADMIN_PASSWORD,
};
let catalog = legacyCatalogFixture();
const app = express();
app.use(express.json());
const database = drizzle(postgres) as unknown as Parameters<typeof createOrdersRouter>[0];
mountSecurity(app,database);
app.use(
  "/api",
  createOrdersRouter(
    drizzle(postgres) as unknown as Parameters<typeof createOrdersRouter>[0],
    async () => catalog,
  ),
);
let server: ReturnType<typeof app.listen>;
let base: string;
before(async () => {
  process.env.SESSION_SECRET = "isolated-workflow-secret";
  process.env.VARSA_ADMIN_PASSWORD = password;
  await postgres.exec(`CREATE TABLE orders (
    id serial PRIMARY KEY, order_number varchar(32) NOT NULL UNIQUE,
    customer_name varchar(120) NOT NULL, phone varchar(32) NOT NULL,
    address text NOT NULL, items jsonb NOT NULL, total integer NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await migrateTest(postgres);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}/api`;
});
beforeEach(async () => {
  await postgres.exec(
    "TRUNCATE orders RESTART IDENTITY CASCADE; TRUNCATE admin_login_attempts",
  );
  catalog = legacyCatalogFixture();
});
after(async () => {
  if (server)
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  await postgres.close();
  if (previous.secret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = previous.secret;
  if (previous.password === undefined) delete process.env.VARSA_ADMIN_PASSWORD;
  else process.env.VARSA_ADMIN_PASSWORD = previous.password;
});
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
) {
  const response = await secureFetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Cookie: token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
const intent = () => ({
  idempotencyKey: randomUUID(),
  customerName: "Isolated workflow",
  phone: "۰۹۱۲۳۴۵۶۷۸۹",
  address: "Synthetic isolated address",
  items: [{ productId: catalog[0].id, quantity: 2 }],
  expectedTotal: catalog[0].price * 2,
});
async function login() {
  return loginAdmin(base,database,password);
}

test("production router preserves one order across creation, admin status change, filtering and replay after catalog changes", async () => {
  assert.equal((await request("/admin/orders")).status, 401);
  assert.equal(
    (await request("/admin/orders/1/status", "PATCH", { status: "shipped" }))
      .status,
    401,
  );
  const body = intent();
  const created = await request("/orders", "POST", body);
  assert.equal(created.status, 201);
  assert.equal(created.body.total, body.expectedTotal);
  assert.equal(created.body.status, "pending");
  const token = await login();
  const listed = await request("/admin/orders", "GET", undefined, token);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.orders.length, 1);
  const order = listed.body.orders[0];
  assert.equal(order.phone, "09123456789");
  assert.equal(order.items[0].quantity, 2);
  assert.equal(order.items[0].unitPrice, catalog[0].price);
  assert.equal(order.items[0].name, catalog[0].name);
  assert.ok(!("idempotencyKey" in order));
  assert.ok(!("requestFingerprint" in order));
  const updated = await request(
    `/admin/orders/${order.id}/status`,
    "PATCH",
    { status: "shipped" },
    token,
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.body.order.status, "shipped");
  assert.ok(!("idempotencyKey" in updated.body.order));
  assert.ok(!("requestFingerprint" in updated.body.order));
  assert.equal(
    (await request("/admin/orders?status=pending", "GET", undefined, token))
      .body.orders.length,
    0,
  );
  assert.equal(
    (await request("/admin/orders?status=shipped", "GET", undefined, token))
      .body.orders.length,
    1,
  );
  catalog = [];
  const replay = await request("/orders", "POST", body);
  assert.equal(replay.status, 201);
  assert.equal(replay.body.orderNumber, created.body.orderNumber);
  assert.equal(replay.body.status, "shipped");
  assert.equal(replay.body.total, created.body.total);
  assert.equal(
    (
      await postgres.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM orders",
      )
    ).rows[0].count,
    1,
  );
});

test("workflow rejects invalid submissions, forged admin tokens and invalid updates without mutating a saved order", async () => {
  const body = intent();
  assert.equal(
    (await request("/orders", "POST", { ...body, phone: "02112345678" }))
      .status,
    400,
  );
  assert.equal(
    (
      await request("/orders", "POST", {
        ...body,
        items: [{ ...body.items[0], quantity: 100 }],
      })
    ).status,
    400,
  );
  assert.equal(
    (await request("/orders", "POST", { ...body, expectedTotal: 1 })).status,
    409,
  );
  const created = await request("/orders", "POST", body);
  assert.equal(created.status, 201);
  assert.equal(
    (await request("/admin/login", "POST", { password: "wrong" })).status,
    401,
  );
  const token = await login();
  assert.equal(
    (await request("/admin/orders", "GET", undefined, token + "x")).status,
    401,
  );
  const before = (await request("/admin/orders", "GET", undefined, token)).body
    .orders;
  for (const [id, status, expected] of [
    [created.body.id, "invented", 400],
    ["bad-id", "confirmed", 400],
    ["999999", "confirmed", 404],
  ] as const) {
    assert.equal(
      (await request(`/admin/orders/${id}/status`, "PATCH", { status }, token))
        .status,
      expected,
    );
  }
  assert.deepEqual(
    (await request("/admin/orders", "GET", undefined, token)).body.orders,
    before,
  );
  assert.equal(
    (await request("/orders", "POST", { ...body, address: "Changed intent" }))
      .status,
    409,
  );
  assert.equal(
    (
      await postgres.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM orders",
      )
    ).rows[0].count,
    1,
  );
});


