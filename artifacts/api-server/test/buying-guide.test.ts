import test from 'node:test';
import assert from 'node:assert/strict';
import type { CatalogProduct } from '@workspace/catalog';
import { buildGuideGroups, categoryGuide, guideModeHref, isGiftCategory, readGuideMode } from '../../varsa-shop/src/lib/buying-guide.ts';
import { legacyCatalogFixture } from './catalog-fixture.ts';
const sample = legacyCatalogFixture()[0];
const product = (slug: string, category: string, price: number, weight = 1, unit = 'گرم'): CatalogProduct => ({ ...sample, id:slug, slug, name:slug, category:category as CatalogProduct['category'], price, weight, weight_unit:unit });

test('guide counts products and uses fresh price bounds and distinct weights per real category', () => {
  const rows = [product('a','نگین',320000),product('b','نگین',610000,2),product('c','سرگل',260000),product('d','نگین',330000)];
  const groups = buildGuideGroups(rows, 'types');
  assert.equal(groups.length,2); assert.equal(groups[0].category,'نگین'); assert.equal(groups[0].count,3);
  assert.equal(groups[0].minPrice,320000); assert.equal(groups[0].maxPrice,610000);
  assert.deepEqual(groups[0].weights,[{weight:1,unit:'گرم'},{weight:2,unit:'گرم'}]);
  assert.equal(buildGuideGroups([{...rows[0],price:1230000}], 'types')[0].minPrice,1230000);
});

test('lower cost mode ranks pack amounts without mutating catalog order or converting units', () => {
  const rows = [product('large','نگین',600000,2),product('small','سرگل',260000),product('mesghal','نگین',500000,1,'مثقال')];
  const original = structuredClone(rows);
  const groups = buildGuideGroups(rows, 'price');
  assert.deepEqual(groups.map(g=>g.category),['سرگل','نگین']);
  assert.deepEqual(groups[1].lowestPriceProduct,{name:'mesghal',price:500000});
  assert.deepEqual(groups[1].weights,[{weight:2,unit:'گرم'},{weight:1,unit:'مثقال'}]);
  assert.deepEqual(rows,original);
});

test('zero priced catalog entries remain explicit and ties retain catalog order', () => {
  const groups = buildGuideGroups([product('first','رشته',0),product('second','پوشال',0)],'price');
  assert.deepEqual(groups.map(g=>[g.category,g.minPrice]),[['رشته',0],['پوشال',0]]);
});

test('gift mode only uses categories explicitly named as gifts and empty remains empty', () => {
  const rows=[product('a','نگین',320000),product('b','هدیه',480000),product('c','هدیه ویژه',900000),product('d','هدیه\u200cهای سازمانی',1200000)];
  assert.deepEqual(buildGuideGroups(rows,'gift').map(g=>g.category),['هدیه','هدیه ویژه','هدیه\u200cهای سازمانی']);
  assert.deepEqual(buildGuideGroups(rows.slice(0,1),'gift'),[]);
  assert.equal(isGiftCategory('اهدیه'),false);
  assert.deepEqual(buildGuideGroups([], 'types'),[]);
});

test('unknown and reserved category names are preserved without invented cut claims', () => {
  const category='دسته تازه & ویژه +';
  assert.equal(buildGuideGroups([product('a',category,120000)],'types')[0].category,category);
  assert.equal(categoryGuide(category).cut,undefined);
  assert.equal(categoryGuide('رشته').cut,undefined);
  assert.equal(categoryGuide('نگین').cut,'intact');
  assert.equal(categoryGuide('سرگل').cut,'pieces');
  assert.equal(categoryGuide('پوشال').cut,'style');
});

test('guide does not display impossible mass values or assume a unit conversion', () => {
  const rows=[product('a','نگین',100,0),product('b','نگین',200,-1),product('c','نگین',300,1,'مثقال')];
  assert.deepEqual(buildGuideGroups(rows,'types')[0].weights,[{weight:1,unit:'مثقال'}]);
});

test('guide mode URLs survive reload and preserve unrelated query parameters', () => {
  for(const mode of ['types','price','gift'] as const) {
    const href=guideModeHref(mode,'utm_source=test&mode=old&mode=duplicate');
    const url=new URL(href,'https://shop.example.test');
    assert.equal(url.pathname,'/guide');assert.equal(readGuideMode(url.search),mode);
    assert.equal(url.searchParams.get('utm_source'),'test');assert.deepEqual(url.searchParams.getAll('mode'),[mode]);
  }
  for(const search of ['','mode=unknown','mode=%3Cscript%3E','MODE=gift']) assert.equal(readGuideMode(search),'types');
});
