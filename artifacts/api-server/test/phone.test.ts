import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { once } from 'node:events';
import express from 'express';
import { normalizeIranMobile, MOBILE_PHONE_ERROR } from '@workspace/validation';
import { createOrderHandler } from '../src/lib/create-order';
import { legacyCatalogFixture } from './catalog-fixture';

type SavedInput = Parameters<Parameters<typeof createOrderHandler>[0]>[0];
const saved: SavedInput[] = [];
let catalogReads = 0;
let baseUrl: string;
const app = express();
app.use(express.json());
app.post('/api/orders', createOrderHandler(async (order) => {
  saved.push(order);
  return { id: saved.length, orderNumber: order.orderNumber, status: 'pending', total: order.total, requestFingerprint: order.requestFingerprint, createdAt: new Date() };
}, async () => { catalogReads++; return legacyCatalogFixture(); }, async () => null));
const server = app.listen(0, '127.0.0.1');
before(async () => {
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});
beforeEach(() => { saved.length = 0; catalogReads = 0; });
after(() => new Promise<void>((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
  server.closeAllConnections();
}));

async function submit(phone: unknown) {
  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: randomUUID(), customerName: 'test', phone, address: 'test',
      items: [{ productId: 'local-super-negin-1g', quantity: 1 }] }),
  });
  return { status: response.status, body: await response.json() };
}

const accepted: [string, string][] = [
  ['09123456789', '09123456789'],
  ['۰۹۱۲۳۴۵۶۷۸۹', '09123456789'],
  ['٠٩١٢٣٤٥٦٧٨٩', '09123456789'],
  ['09۱۲٣٤56۷۸9', '09123456789'],
  [' 0912 345 6789 ', '09123456789'],
  ['۰۹۱۲-۳۴۵-۶۷۸۹', '09123456789'],
  ['0912\u00a0345\u00a06789', '09123456789'],
  ['+989123456789', '09123456789'],
  ['+۹۸ ۹۱۲ ۳۴۵ ۶۷۸۹', '09123456789'],
  ['+٩٨٩١٢٣٤٥٦٧٨٩', '09123456789'],
  ['00989123456789', '09123456789'],
  ['۰۰۹۸-۹۱۲-۳۴۵-۶۷۸۹', '09123456789'],
  ['09351234567', '09351234567'],
];
for (const [input, canonical] of accepted) {
  test(`accepts and stores a canonical mobile: ${JSON.stringify(input)}`, async () => {
    assert.equal(normalizeIranMobile(input), canonical);
    assert.equal(normalizeIranMobile(canonical), canonical);
    const response = await submit(input);
    assert.equal(response.status, 201);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].phone, canonical);
    assert.match(saved[0].phone, /^09[0-9]{9}$/);
  });
}

const rejected: unknown[] = [
  '', '   ', '123', '0912345678', '091234567890', '9123456789',
  '02191002030', '08123456789', '00912345678', '+449123456789',
  '+9809123456789', '009809123456789', '989123456789',
  '0912abc3456789', '0912.345.6789', '0912/345/6789', '(0912)3456789',
  '++989123456789', '+98+9123456789', '۰۹۱۲۳۴۵۶۷۸',
  '０９１２３４５６７８９', '0912\u200b3456789',
  ' '.repeat(54) + '09123456789', '<script>09123456789</script>',
  null, undefined, 9123456789, true, {}, ['09123456789'],
];
for (const [index, input] of rejected.entries()) {
  test(`rejects invalid phone case ${index + 1} before catalog access or persistence`, async () => {
    assert.equal(normalizeIranMobile(input), null);
    const response = await submit(input);
    assert.equal(response.status, 400);
    assert.equal(response.body.message, MOBILE_PHONE_ERROR);
    assert.equal(catalogReads, 0);
    assert.equal(saved.length, 0);
  });
}
