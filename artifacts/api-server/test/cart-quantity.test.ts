import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addCartItem, updateCartQuantity, normalizeCartItems, restoreCartState, addToStoredCart } from '../../varsa-shop/src/lib/cart-state';
import { legacyCatalogFixture } from './catalog-fixture';

const product = legacyCatalogFixture()[0];
test('cart identity persists across reload and changes only for a new empty-to-filled cart', () => {
  const original = restoreCartState([{ product, quantity: 2 }], () => '11111111-1111-4111-8111-111111111111');
  const reloaded = restoreCartState(JSON.parse(JSON.stringify(original)), () => { throw new Error('must reuse saved ID'); });
  assert.equal(reloaded.attemptId, original.attemptId);
  assert.equal(addToStoredCart(reloaded, product).attemptId, original.attemptId);
  const newCart = addToStoredCart({ ...reloaded, items: [] }, product, 1, () => '22222222-2222-4222-8222-222222222222');
  assert.notEqual(newCart.attemptId, original.attemptId);
});
test('add and repeated add cannot exceed 99 units', () => {
  let items = addCartItem([], product, 98);
  items = addCartItem(items, product);
  assert.equal(items[0].quantity, 99);
  assert.equal(addCartItem(items, product)[0].quantity, 99);
  assert.equal(addCartItem([], product, 100)[0].quantity, 99);
});
test('increase, decrease and zero removal use the same cap', () => {
  const items = addCartItem([], product, 2);
  assert.equal(updateCartQuantity(items, product.id, 100)[0].quantity, 99);
  assert.equal(updateCartQuantity(items, product.id, 1)[0].quantity, 1);
  assert.deepEqual(updateCartQuantity(items, product.id, 0), []);
});
for (const count of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  test(`invalid cart mutation ${String(count)} preserves the previous cart`, () => {
    const items = addCartItem([], product, 2);
    assert.deepEqual(addCartItem(items, product, count), items);
    assert.deepEqual(updateCartQuantity(items, product.id, count), items);
  });
}
test('restoring untrusted storage merges duplicates, caps old counts and skips malformed rows', () => {
  const items = normalizeCartItems([
    { product, quantity: 98 }, { product, quantity: 20 },
    { product: legacyCatalogFixture()[1], quantity: 0 },
    { product: legacyCatalogFixture()[2], quantity: '2' },
    { product: null, quantity: 2 }, null,
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 99);
  assert.deepEqual(normalizeCartItems({}), []);
});
test('cart refresh merges old aliases after catalog reconciliation', () => {
  const canonical = { ...product, id: 'canonical-id' };
  const refreshed = normalizeCartItems([
    { product: canonical, quantity: 60 }, { product: canonical, quantity: 60 },
  ]);
  assert.equal(refreshed.length, 1);
  assert.equal(refreshed[0].quantity, 99);
});
test('maximum distinct products is 50 and existing products can still be increased', () => {
  const full = normalizeCartItems(Array.from({ length: 51 }, (_, i) => ({ product: { ...product, id: `p-${i}`, slug: `p-${i}` }, quantity: 1 })));
  assert.equal(full.length, 50);
  assert.equal(addCartItem(full, product).length, 50);
  assert.equal(addCartItem(full, full[0].product)[0].quantity, 2);
});
