import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { once } from 'node:events';
import express from 'express';
import { createOrderHandler } from '../src/lib/create-order';
import { legacyCatalogFixture } from './catalog-fixture';

type OrderToSave = Parameters<Parameters<typeof createOrderHandler>[0]>[0];
const savedOrders: OrderToSave[] = [];
let failStorage = false;
let orderCatalog = legacyCatalogFixture();
let baseUrl: string;
const app = express();
app.use(express.json());
app.post('/api/orders', createOrderHandler(async (order) => {
  if (failStorage) throw new Error('private database connection details');
  savedOrders.push(structuredClone(order));
  return {
    id: savedOrders.length,
    orderNumber: order.orderNumber,
    status: 'pending',
    total: order.total,
    requestFingerprint: order.requestFingerprint, createdAt: new Date('2026-10-18T12:00:00Z'),
  };
}, async () => orderCatalog, async () => null));
const server = app.listen(0, '127.0.0.1');

before(async () => {
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});
beforeEach(() => {
  savedOrders.length = 0;
  failStorage = false;
  orderCatalog = legacyCatalogFixture();
});
after(() => new Promise<void>((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
  server.closeAllConnections();
}));

const customer = { customerName: 'مشتری تست', phone: '09120000000', address: 'نشانی تست' };
async function post(body: unknown) {
  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: randomUUID(), ...(body as object) }),
  });
  return { status: response.status, body: await response.json() };
}

test('accepts checkout IDs and quantities; snapshots trusted product details', async () => {
  const response = await post({ ...customer, items: [
    { productId: 'local-super-negin-1g', quantity: 2 },
    { productId: 'local-poshal-2g', quantity: 3 },
  ] });
  assert.equal(response.status, 201);
  assert.equal(response.body.total, 3_055_000);
  assert.equal(savedOrders.length, 1);
  assert.equal(savedOrders[0].total, 3_055_000);
  assert.deepEqual(savedOrders[0].items?.[0], {
    productId: 'local-super-negin-1g', quantity: 2, unitPrice: 449000,
    name: 'زعفران سوپر نگین ورسا ۱ گرمی', imageUrl: '/products/super-negin-1g.png',
  });
  assert.equal(savedOrders[0].items?.[1].unitPrice, 719000);
});

for (const price of [0, 1, -100, 0.01, null, '0', 1e99]) {
  test(`ignores forged unit price ${JSON.stringify(price)} and top-level total`, async () => {
    const response = await post({ ...customer, total: 0, items: [{
      productId: 'local-super-negin-1g', quantity: 2, unitPrice: price,
      name: 'forged product', imageUrl: 'https://attacker.invalid/image.png',
    }] });
    assert.equal(response.status, 201);
    assert.equal(response.body.total, 898000);
    assert.equal(savedOrders[0].total, 898000);
    assert.equal(savedOrders[0].items?.[0].unitPrice, 449000);
    assert.equal(savedOrders[0].items?.[0].name, 'زعفران سوپر نگین ورسا ۱ گرمی');
    assert.equal(savedOrders[0].items?.[0].imageUrl, '/products/super-negin-1g.png');
  });
}

for (const productId of ['missing', '__proto__', 'constructor', 'local-super-negin-1g-fake', '', null, 1]) {
  test(`rejects invalid product ${JSON.stringify(productId)} before saving`, async () => {
    const response = await post({ ...customer, items: [{ productId, quantity: 1, unitPrice: 0 }] });
    assert.equal(response.status, 400);
    assert.equal(savedOrders.length, 0);
  });
}

test('rejects the whole order when one item is unknown', async () => {
  const response = await post({ ...customer, items: [
    { productId: 'local-super-negin-1g', quantity: 1 },
    { productId: 'missing', quantity: 1 },
  ] });
  assert.equal(response.status, 400);
  assert.equal(savedOrders.length, 0);
});

for (const quantity of [0, -1, 1.5, 100, '2', null]) {
  test(`rejects invalid quantity ${JSON.stringify(quantity)}`, async () => {
    const response = await post({ ...customer, items: [{ productId: 'local-super-negin-1g', quantity }] });
    assert.equal(response.status, 400);
    assert.equal(savedOrders.length, 0);
  });
}

test('preserves the existing maximum of 99 units per line', async () => {
  const response = await post({ ...customer, items: [{ productId: 'local-super-negin-1g', quantity: 99 }] });
  assert.equal(response.status, 201);
  assert.equal(response.body.total, 44_451_000);
});

for (const items of [[], null, {}, [null], [[]], Array.from({ length: 51 }, () => ({ productId: 'local-super-negin-1g', quantity: 1 }))]) {
  test(`rejects malformed or oversized item list (${JSON.stringify(items).slice(0, 45)})`, async () => {
    const response = await post({ ...customer, items });
    assert.equal(response.status, 400);
    assert.equal(savedOrders.length, 0);
  });
}

test('rejects totals exceeding the database integer range', async () => {
  orderCatalog[0].price = 30_000_000;
  const response = await post({ ...customer, items: [{ productId: orderCatalog[0].id, quantity: 99 }] });
  assert.equal(response.status, 400);
  assert.equal(savedOrders.length, 0);
});

test('combines duplicate product lines without changing the total', async () => {
  const response = await post({ ...customer, items: [
    { productId: 'local-super-negin-1g', quantity: 49 },
    { productId: 'local-super-negin-1g', quantity: 50 },
  ] });
  assert.equal(response.status, 201);
  assert.equal(response.body.total, 44_451_000);
  assert.equal(savedOrders[0].items?.length, 1);
  assert.equal(savedOrders[0].items?.[0].quantity, 99);
});

test('rejects splitting 100 units of one product across otherwise valid lines', async () => {
  const response = await post({ ...customer, items: [
    { productId: 'local-super-negin-1g', quantity: 60 },
    { productId: 'local-super-negin-1g', quantity: 40 },
  ] });
  assert.equal(response.status, 400);
  assert.equal(savedOrders.length, 0);
});

test('allows 99 units of each of two different products', async () => {
  const response = await post({ ...customer, items: [
    { productId: 'local-super-negin-1g', quantity: 99 },
    { productId: 'local-poshal-2g', quantity: 99 },
  ] });
  assert.equal(response.status, 201);
  assert.equal(savedOrders[0].items?.length, 2);
  assert.equal(response.body.total, 115_632_000);
});

test('returns a generic failure without claiming success when persistence fails', async () => {
  failStorage = true;
  const response = await post({ ...customer, items: [{ productId: 'local-super-negin-1g', quantity: 1 }] });
  assert.equal(response.status, 500);
  assert.equal(savedOrders.length, 0);
  assert(!JSON.stringify(response.body).includes('private database'));
  assert.equal(response.body.orderNumber, undefined);
});
