import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { brandArtworkSrcSet } from '../../varsa-shop/src/lib/brand-artwork.ts';
import { pexelsCropSrcSet } from '../../varsa-shop/src/lib/image-delivery.ts';

test('local responsive sources follow the approved asset and deployment subfolder', () => {
  const sources = brandArtworkSrcSet('/store/products/negin-1g.png','https://shop.example.test/store/');
  assert.equal(sources?.split(', ').length,5);
  assert.ok(sources?.includes('https://shop.example.test/store/products/negin-1g-320.webp 320w'));
  assert.equal(brandArtworkSrcSet('/products/negin-1g.png','https://shop.example.test/store/'),undefined);
  for (const value of ['/store/products/negin-1g.png?v=2','/store/products/negin-1g.png#new','https://photos.example.test/products/negin-1g.png','/store/products/sargol-1g.png']) {
    assert.equal(brandArtworkSrcSet(value,'https://shop.example.test/store/'),undefined);
  }
});

const original='https://images.pexels.com/photos/33654800/pexels-photo-33654800.jpeg?auto=compress&cs=tinysrgb&h=900&w=900';
test('Pexels square delivery retains the photograph identity, host and compression parameters', () => {
  const candidates=pexelsCropSrcSet(original)?.split(', ');
  assert.equal(candidates?.length,4);
  for (const candidate of candidates!) {
    const [value, descriptor]=candidate.split(' ');
    const url=new URL(value);
    assert.equal(url.origin+url.pathname,new URL(original).origin+new URL(original).pathname);
    assert.equal(url.searchParams.get('w')+'w',descriptor);
    assert.equal(url.searchParams.get('h'),url.searchParams.get('w'));
    assert.equal(url.searchParams.get('auto'),'compress');
    assert.equal(url.searchParams.get('fit'),'crop');
  }
});

test('signed, custom, duplicate, cropped, malformed and unknown image URLs remain untouched', () => {
  for (const value of [original+'&signature=abc',original+'&w=900',original+'&fit=crop',original+'#new',original.replace('h=900','h=600'),original.replace('images.pexels.com','photos.example.test'),original.replace('https:','http:'),original.replace('/33654800/','/42/'),original.replace('images.pexels.com','user:secret@images.pexels.com'),'not a URL']) {
    assert.equal(pexelsCropSrcSet(value),undefined,value);
  }
});

test('article candidates match the displayed 16:10 cover while keeping its source identity', () => {
  const article=original.replace('h=900&w=900','h=650&w=940');
  const candidates=pexelsCropSrcSet(article,'landscape')!.split(', ');
  assert.equal(candidates.length,4);
  assert.ok(candidates[1].includes('h=200&w=320'));
  assert.ok(candidates[3].includes('h=588&w=940'));
});

test('all local variants exist, match the delivery manifest and leave original PNGs unchanged', async () => {
  const manifest=JSON.parse(await readFile(new URL('../../../docs/brand-image-sizes.json',import.meta.url),'utf8'));
  for (const entry of manifest) {
    const source=await readFile(new URL(`../../varsa-shop/public/products/${entry.source}`,import.meta.url));
    assert.equal(createHash('sha256').update(source).digest('hex'),entry.sha256);
    for (const variant of entry.variants) {
      const bytes=await readFile(new URL(`../../varsa-shop/public/products/${variant.file}`,import.meta.url));
      assert.equal(bytes.toString('ascii',0,4),'RIFF');
      assert.equal(bytes.toString('ascii',8,12),'WEBP');
      assert.equal(bytes.length,variant.bytes);
      assert.ok(bytes.length<source.length/5);
    }
  }
});
