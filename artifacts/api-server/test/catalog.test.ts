import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { once } from 'node:events';
import express from 'express';
import { CatalogUnavailableError, loadCatalogProducts, reconcileCart, type CatalogProduct } from '@workspace/catalog';
import { createOrderHandler } from '../src/lib/create-order';
import { legacyCatalogFixture } from './catalog-fixture';

let rows: CatalogProduct[];
let catalogStatus = 200;
let loadCount = 0;
let baseUrl: string;
type SavedInput = Parameters<Parameters<typeof createOrderHandler>[0]>[0];
const saved: SavedInput[] = [];
const app = express();
app.use(express.json());
app.get('/rest/v1/products', (req, res) => {
  loadCount++;
  assert.equal(req.header('apikey'), 'test-public-key');
  if (catalogStatus !== 200) { res.status(catalogStatus).json({ error: 'offline' }); return; }
  const offset = Number(req.query.offset ?? 0);
  const limit = Number(req.query.limit ?? 1000);
  res.json(rows.slice(offset, offset + limit));
});
const load = () => loadCatalogProducts({ url: baseUrl, anonKey: 'test-public-key' });
app.post('/api/orders', createOrderHandler(async (order) => {
  saved.push(structuredClone(order));
  return { id: saved.length, orderNumber: order.orderNumber, status: 'pending', total: order.total, requestFingerprint: order.requestFingerprint, createdAt: new Date() };
}, load, async () => null));
const server = app.listen(0, '127.0.0.1');
before(async () => {
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});
beforeEach(() => {
  rows = legacyCatalogFixture();
  rows[0].id = 'database-product-id';
  catalogStatus = 200; loadCount = 0; saved.length = 0;
});
after(() => new Promise<void>((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
  server.closeAllConnections();
}));
async function order(productId: string, expectedTotal?: number) {
  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: randomUUID(), customerName: 'test', phone: '09120000000', address: 'test',
      expectedTotal, items: [{ productId, quantity: 2, unitPrice: 0, name: 'forged' }] }),
  });
  return { status: response.status, body: await response.json() };
}

test('database edits replace local prices and all display fields without changing the row ID', async () => {
  await load();
  rows[0] = { ...rows[0], price: 555000, name: 'edited name', short_description: 'edited description', image_url: '/edited.png', is_featured: false };
  const products = await load();
  assert.deepEqual(products[0], rows[0]);
  assert.equal(products[0].id, 'database-product-id');
  assert.equal(loadCount, 2);
});

test('new database slugs appear even when absent from the legacy catalog', async () => {
  rows.push({ ...rows[0], id: 'new-id', slug: 'new-gift', category: 'هدیه', name: 'new gift' });
  assert.equal((await load()).at(-1)?.slug, 'new-gift');
});

test('deletion and an empty database do not resurrect bundled products', async () => {
  rows = [];
  assert.deepEqual(await load(), []);
  assert.equal((await order('local-super-negin-1g')).status, 400);
  assert.equal(saved.length, 0);
});

test('orders re-read the latest database price and ignore all forged prices', async () => {
  assert.equal((await order('database-product-id')).body.total, 898000);
  rows[0].price = 555000;
  rows[0].name = 'updated database name';
  const result = await order('database-product-id');
  assert.equal(result.status, 201);
  assert.equal(result.body.total, 1110000);
  assert.equal(saved[1].items?.[0].name, 'updated database name');
  assert.equal(saved[1].items?.[0].unitPrice, 555000);
  assert.equal(saved[0].total, 898000); // earlier order snapshot is unchanged
});

test('old local cart IDs map to the current database ID only while its slug exists', async () => {
  assert.equal((await order('local-super-negin-1g')).status, 201);
  assert.equal(saved[0].items?.[0].productId, 'database-product-id');
  rows = rows.slice(1);
  assert.equal((await order('local-super-negin-1g')).status, 400);
  assert.equal(saved.length, 1);
});

test('stale displayed totals get 409 without saving; reviewing the new total permits retry', async () => {
  rows[0].price = 555000;
  assert.equal((await order('database-product-id', 898000)).status, 409);
  assert.equal(saved.length, 0);
  assert.equal((await order('database-product-id', 1110000)).status, 201);
});

test('outage rejects catalog reads and orders without using old static prices', async () => {
  catalogStatus = 503;
  await assert.rejects(load, CatalogUnavailableError);
  assert.equal((await order('database-product-id')).status, 503);
  assert.equal(saved.length, 0);
});

test('missing configuration fails closed', async () => {
  await assert.rejects(() => loadCatalogProducts({ url: undefined, anonKey: undefined }), CatalogUnavailableError);
});

for (const price of [-1, 1.5, '449000', null, 2_147_483_648]) {
  test(`invalid database price ${JSON.stringify(price)} cannot be charged`, async () => {
    rows[0].price = price as number;
    await assert.rejects(load, CatalogUnavailableError);
    assert.equal((await order('database-product-id')).status, 503);
    assert.equal(saved.length, 0);
  });
}

test('pagination includes products after the first 1000 rows', async () => {
  const template = rows[0];
  rows = Array.from({ length: 1001 }, (_, i) => ({ ...template, id: `db-${i}`, slug: `slug-${i}` }));
  const products = await load();
  assert.equal(products.length, 1001);
  assert.equal(products[1000].id, 'db-1000');
  assert.equal(loadCount, 2);
});

test('cart reconciliation refreshes price and legacy ID, while flagging removed products', () => {
  const old = legacyCatalogFixture()[0];
  const current = { ...rows[0], price: 555000 };
  const result = reconcileCart([{ product: old, quantity: 2 }], [current]);
  assert.equal(result.changed, true);
  assert.equal(result.items[0].product.id, current.id);
  assert.equal(result.items[0].product.price, 555000);
  assert.equal(result.items[0].quantity, 2);
  assert.deepEqual(result.missingIds, []);
  assert.deepEqual(reconcileCart([{ product: old, quantity: 2 }], []).missingIds, [old.id]);
  assert.equal(reconcileCart(result.items, [current]).changed, false);
});

test('canonical and legacy IDs cannot bypass the per-product quantity cap', async () => {
  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: randomUUID(), customerName: 'test', phone: '09120000000', address: 'test', items: [
      { productId: 'database-product-id', quantity: 60 },
      { productId: 'local-super-negin-1g', quantity: 40 },
    ] }),
  });
  assert.equal(response.status, 400);
  assert.equal(saved.length, 0);
});
