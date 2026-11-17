import test from 'node:test';
import assert from 'node:assert/strict';
import { isBrandArtworkUrl } from '../../varsa-shop/src/lib/brand-artwork.ts';

test('provided artwork is identified for relative and absolute catalog URLs', () => {
  assert.equal(isBrandArtworkUrl('/products/negin-1g.png','https://shop.example.test/'),true);
  assert.equal(isBrandArtworkUrl('https://shop.example.test/products/poshal-2g.png?v=1','https://shop.example.test/'),true);
});
test('artwork disclosure follows a deployed subfolder', () => {
  assert.equal(isBrandArtworkUrl('/store/products/negin-2g.png','https://shop.example.test/store/'),true);
  assert.equal(isBrandArtworkUrl('products/negin-2g.png','https://shop.example.test/store'),true);
  assert.equal(isBrandArtworkUrl('/products/negin-2g.png','https://shop.example.test/store/'),false);
});
test('other photographs and unmatched products are not relabeled as provided artwork', () => {
  for (const value of ['https://photos.example.test/products/negin-1g.png','/products/sargol-1g.png','/products/gift-set-luxe.png','/approved-photo.jpg']) {
    assert.equal(isBrandArtworkUrl(value,'https://shop.example.test/'),false);
  }
});
test('invalid or credential-bearing image URLs cannot be treated as known artwork', () => {
  for (const value of ['https://user:secret@shop.example.test/products/negin-1g.png','javascript:alert(1)','https://[invalid']) {
    assert.equal(isBrandArtworkUrl(value,'https://shop.example.test/'),false);
  }
  assert.equal(isBrandArtworkUrl('/products/negin-1g.png','not a URL'),false);
});
