import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import express from 'express';
import { setBaseUrl } from '../../../lib/api-client-react/src/index';
import { submitOrder } from '../../varsa-shop/src/lib/orders-api';
import { getOrderSubmitErrorMessage, ORDER_RECEIPT_STATUS, parseOrderReceipt, UNCONFIRMED_ORDER_MESSAGE, UNCERTAIN_ORDER_MESSAGE } from '../../varsa-shop/src/lib/order-receipt';

const receipt = { id: '7', orderNumber: 'VRS-TEST-7', status: 'pending', total: 449000, createdAt: '2026-10-18T15:00:00.000Z' };
const request = { idempotencyKey: '12345678-1234-4234-8234-123456789012', customerName: 'test', phone: '09120000000', address: 'local', items: [{ productId: 'test', quantity: 1 }] };
let body: unknown = receipt;
let responseStatus = 201;
let html = false;
let receivedKey: unknown;
const app = express(); app.use(express.json());
app.post('/api/orders', (req, res) => { receivedKey = req.body.idempotencyKey; if (html) res.status(responseStatus).type('html').send('<html>private proxy error</html>'); else res.status(responseStatus).json(body); });
let server: ReturnType<typeof app.listen>;
before(async () => {
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert(address && typeof address !== 'string');
  setBaseUrl(`http://127.0.0.1:${address.port}`);
});
after(async () => { setBaseUrl(null); if (server) await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); });

test('checkout returns only a validated receipt and keeps the original retry key', async () => {
  body = receipt; responseStatus = 201;
  assert.deepEqual(await submitOrder(request), receipt);
  assert.equal(receivedKey, request.idempotencyKey);
});
test('all actual order statuses and the server amount survive response parsing', () => {
  for (const status of ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const) {
    const parsed = parseOrderReceipt({ ...receipt, status, total: 719000 });
    assert.equal(parsed.status, status); assert.equal(parsed.total, 719000);
    assert(ORDER_RECEIPT_STATUS[status].label);
  }
  assert.equal(ORDER_RECEIPT_STATUS.pending.label, 'در انتظار بررسی');
  assert.equal(ORDER_RECEIPT_STATUS.cancelled.title, 'سفارش لغو شده است');
});
test('incomplete or malformed successful HTTP responses never confirm an order', async () => {
  for (const invalid of [null, {}, { ...receipt, id: '' }, { ...receipt, orderNumber: ' ' }, { ...receipt, status: 'paid' }, { ...receipt, total: -1 }, { ...receipt, total: 1.5 }, { ...receipt, total: '449000' }, { ...receipt, total: 2147483648 }, { ...receipt, createdAt: 'yesterday' }]) {
    body = invalid; responseStatus = 201;
    await assert.rejects(submitOrder(request), { message: UNCONFIRMED_ORDER_MESSAGE });
    assert.equal(receivedKey, request.idempotencyKey);
  }
});
test('HTML masquerading as successful JSON cannot confirm checkout or expose proxy text', async () => {
  html = true; responseStatus = 200;
  try { await submitOrder(request); assert.fail('HTML cannot confirm checkout'); }
  catch (error) { assert.equal(getOrderSubmitErrorMessage(error), UNCONFIRMED_ORDER_MESSAGE); }
  finally { html = false; }
});
test('server errors use uncertainty wording and validation errors retain actionable messages', async () => {
  body = { message: 'private internal error' }; responseStatus = 500;
  try { await submitOrder(request); assert.fail('500 cannot confirm checkout'); }
  catch (error) { assert.equal(getOrderSubmitErrorMessage(error), UNCERTAIN_ORDER_MESSAGE); }
  body = { message: 'قیمت تغییر کرده است؛ سبد را بررسی کنید.' }; responseStatus = 409;
  try { await submitOrder(request); assert.fail('409 cannot confirm checkout'); }
  catch (error) { assert.equal(getOrderSubmitErrorMessage(error), (body as { message: string }).message); }
});
test('timeouts, network errors and empty failures do not claim that an order was rejected', () => {
  for (const error of [new TypeError('Failed to fetch'), new DOMException('Timed out', 'TimeoutError'), new DOMException('Aborted', 'AbortError'), null, { status: 503 }]) assert.equal(getOrderSubmitErrorMessage(error), UNCERTAIN_ORDER_MESSAGE);
});
