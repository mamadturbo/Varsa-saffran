import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readShopCategory, shopCategoryHref } from '../../varsa-shop/src/lib/shop-filter';

test('all footer category destinations keep their distinct category after URL parsing', () => {
  const categories = ['سوپر نگین', 'نگین', 'شبه نگین', 'پوشال'];
  const links = categories.map(category => shopCategoryHref(category));
  assert.equal(new Set(links).size, 4);
  for (const [index, link] of links.entries()) {
    const url = new URL(link, 'http://localhost');
    assert.equal(url.pathname, '/shop');
    assert.equal(readShopCategory(url.search), categories[index]);
  }
});
test('new database categories and reserved characters round-trip without double decoding', () => {
  for (const category of ['هدیه ویژه', '50% بسته', '%2F', 'a+b & c/d', '<script>']) {
    const url = new URL(shopCategoryHref(category), 'http://localhost');
    assert.equal(readShopCategory(url.search), category);
    assert.equal(url.pathname, '/shop');
  }
});
test('clearing a category preserves unrelated parameters and replaces duplicate category keys', () => {
  const search = '?utm_source=test&category=old&category=older&ref=7';
  const changed = new URL(shopCategoryHref('نگین', search), 'http://localhost');
  assert.deepEqual(changed.searchParams.getAll('category'), ['نگین']);
  assert.equal(changed.searchParams.get('utm_source'), 'test');
  assert.equal(changed.searchParams.get('ref'), '7');
  const cleared = new URL(shopCategoryHref(null, changed.search), 'http://localhost');
  assert.equal(cleared.searchParams.has('category'), false);
  assert.equal(cleared.searchParams.get('ref'), '7');
  assert.equal(shopCategoryHref(null), '/shop');
});
test('absent or empty category means all; unknown values remain selected rather than showing all', () => {
  assert.equal(readShopCategory(''), null); assert.equal(readShopCategory('?category='), null);
  assert.equal(readShopCategory('?category=missing'), 'missing');
  assert.doesNotThrow(() => readShopCategory('?category=%E0%A4%A'));
});
