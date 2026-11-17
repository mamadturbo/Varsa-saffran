import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAGE_PATHS, pagePath, articlePath, productPath, lastPathSegment } from '../../varsa-shop/src/lib/routes';

test('public page and admin addresses are explicit and unknown pages never become home', () => {
  assert.deepEqual(PAGE_PATHS, { home: '/', shop: '/shop', guide: '/guide', journal: '/journal', about: '/about', contact: '/contact', admin: '/admin' });
  assert.equal(pagePath('home'), '/'); assert.equal(pagePath('shop'), '/shop');
  assert.equal(pagePath('guide'), '/guide');
  for (const name of ['missing', '__proto__', 'constructor', 'https://example.com']) assert.equal(pagePath(name), '/not-found');
});
test('dynamic route slugs round-trip exactly once including Persian and reserved characters', () => {
  for (const slug of ['negin-1g', 'راهنمای-زعفران', 'a b', '50%off', 'a?b#c', '%2F', 'a/b']) {
    for (const path of [articlePath(slug), productPath(slug)]) {
      assert.equal(lastPathSegment(path), slug);
      assert.equal(lastPathSegment(`/store${path}/`), slug);
      assert.equal(path.split('/').length, 3);
    }
  }
});
test('malformed URL escape sequences cannot crash detail routes', () => {
  for (const path of ['/journal/%', '/products/%E0%A4%A', '/journal/%ZZ', '/']) assert.equal(lastPathSegment(path), null);
});
