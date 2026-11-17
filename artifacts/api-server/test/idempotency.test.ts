import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createOrderHandler } from '../src/lib/create-order';
import { createOrderRepository } from '../src/lib/order-repository';
import { legacyCatalogFixture } from './catalog-fixture';
import { CatalogUnavailableError } from '@workspace/catalog';

const postgres = new PGlite();
// Both adapters use the same Drizzle PostgreSQL insert/select API at runtime.
const database = drizzle(postgres) as unknown as Parameters<typeof createOrderRepository>[0];
const repositoryA = createOrderRepository(database);
const repositoryB = createOrderRepository(database);
const app = express();
app.use(express.json());
let baseUrl: string;
let server: ReturnType<typeof app.listen>;
let catalogDown = false;
let catalogReads = 0;
let catalog = legacyCatalogFixture();
const load = async () => { catalogReads++; if (catalogDown) throw new CatalogUnavailableError(); return catalog; };
app.post('/api/orders', createOrderHandler(repositoryA.save, load, repositoryA.findByKey));
app.post('/instance-b/orders', createOrderHandler(repositoryB.save, load, repositoryB.findByKey));
app.post('/drop-after-commit', createOrderHandler(async (input) => {
  const saved = await repositoryA.save(input);
  throw new Error(`simulated acknowledgement loss after committing order ${saved.id}`);
}, load, repositoryA.findByKey));

const migration = await readFile(new URL('../../../lib/db/migrations/0001_order_idempotency.sql', import.meta.url), 'utf8');

before(async () => {
  await postgres.exec(`CREATE TABLE orders (
    id serial PRIMARY KEY, order_number varchar(32) NOT NULL UNIQUE,
    customer_name varchar(120) NOT NULL, phone varchar(32) NOT NULL,
    address text NOT NULL, items jsonb NOT NULL, total integer NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
  );`);
  await postgres.exec(migration);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address(); assert(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});
beforeEach(async () => {
  await postgres.exec('TRUNCATE orders RESTART IDENTITY');
  catalogDown = false; catalogReads = 0; catalog = legacyCatalogFixture();
});
after(async () => {
  if (server) await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
  await postgres.close();
});

function payload(idempotencyKey = randomUUID()) {
  return { idempotencyKey, customerName: 'test', phone: '09120000000', address: 'test address',
    expectedTotal: 449000, items: [{ productId: 'local-super-negin-1g', quantity: 1 }] };
}
async function post(body: unknown, path = '/api/orders') {
  const response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
async function countOrders() {
  return (await postgres.query<{ count: number }>('SELECT count(*)::integer AS count FROM orders')).rows[0].count;
}

test('identical retries return the same persisted order', async () => {
  const input = payload();
  const first = await post(input); const retry = await post(input);
  assert.equal(first.status, 201); assert.deepEqual(retry, first);
  assert.equal(await countOrders(), 1);
  assert(!('idempotencyKey' in first.body)); assert(!('requestFingerprint' in first.body));
});
test('25 simultaneous requests across independent repositories create exactly one order', async () => {
  const input = payload();
  const results = await Promise.all(Array.from({ length: 25 }, (_, i) => post(input, i % 2 ? '/api/orders' : '/instance-b/orders')));
  assert(results.every((result) => result.status === 201));
  assert.equal(new Set(results.map((result) => result.body.id)).size, 1);
  assert.equal(await countOrders(), 1);
});
test('same key with different intent returns 409 without a second order', async () => {
  const input = payload(); await post(input);
  assert.equal((await post({ ...input, address: 'different address' })).status, 409);
  assert.equal((await post({ ...input, items: [{ ...input.items[0], quantity: 2 }] })).status, 409);
  assert.equal(await countOrders(), 1);
});
test('racing different payloads with one key yields one success and one conflict', async () => {
  const input = payload();
  const results = await Promise.all([post(input), post({ ...input, address: 'other' }, '/instance-b/orders')]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal(await countOrders(), 1);
});
test('replay works after catalog outage or price changes without repricing the committed order', async () => {
  const input = payload(); const first = await post(input);
  catalogDown = true; const reads = catalogReads;
  assert.deepEqual(await post(input, '/instance-b/orders'), first);
  assert.equal(catalogReads, reads);
  catalogDown = false; catalog[0].price = 555000;
  assert.deepEqual(await post({ ...input, expectedTotal: 555000 }), first);
  assert.equal(await countOrders(), 1);
});
test('lost commit acknowledgement retries safely against persisted state', async () => {
  const input = payload();
  assert.equal((await post(input, '/drop-after-commit')).status, 201);
  assert.equal(await countOrders(), 1);
  const retry = await post(input, '/instance-b/orders');
  assert.equal(retry.status, 201); assert.equal(retry.body.id, '1');
  assert.equal(await countOrders(), 1);
});
test('failed price validation does not reserve a key and permits corrected retry', async () => {
  const input = payload();
  assert.equal((await post({ ...input, expectedTotal: 1 })).status, 409);
  assert.equal(await countOrders(), 0);
  assert.equal((await post(input)).status, 201);
});
test('new logical attempt with a new key can intentionally order the same items again', async () => {
  assert.equal((await post(payload())).status, 201);
  assert.equal((await post(payload())).status, 201);
  assert.equal(await countOrders(), 2);
});
test('normalization and item order do not change request identity', async () => {
  const input = { ...payload(), expectedTotal: 1168000, items: [
    { productId: 'local-super-negin-1g', quantity: 1 }, { productId: 'local-poshal-2g', quantity: 1 },
  ] };
  const first = await post(input);
  assert.equal(first.status, 201);
  assert.deepEqual(await post({ ...input, customerName: ' test ', phone: '۰۹۱۲۰۰۰۰۰۰۰', address: ' test address ', items: [...input.items].reverse() }), first);
});
for (const key of [null, undefined, 'not-a-uuid', '00000000-0000-1000-8000-000000000000']) {
  test(`invalid idempotency key ${String(key)} cannot create an order`, async () => {
    assert.equal((await post({ ...payload(), idempotencyKey: key })).status, 400);
    assert.equal(await countOrders(), 0);
  });
}
test('migration can be reapplied and preserves legacy orders without keys', async () => {
  await postgres.exec(`INSERT INTO orders (order_number,customer_name,phone,address,items,total) VALUES ('legacy','legacy','legacy','legacy','[]',1)`);
  await postgres.exec(migration);
  assert.equal(await countOrders(), 1);
  const old = await postgres.query<{ idempotency_key: null }>('SELECT idempotency_key FROM orders');
  assert.equal(old.rows[0].idempotency_key, null);
});
