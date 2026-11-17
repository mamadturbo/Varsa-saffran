import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogWeightChoices, categoryPackages, matchesShopWeight, productUnitPrice, readShopWeight, shopWeightHref, weightUnit } from '../../varsa-shop/src/lib/product-comparison.ts';
import type { CatalogProduct } from '@workspace/catalog';
import { legacyCatalogFixture } from './catalog-fixture.ts';
const sample = legacyCatalogFixture()[0];
const product = (id: string, weight: number, price: number, unit = 'گرم', category = 'نگین'): CatalogProduct =>
  ({ ...sample, id, slug: id, name: id, weight, weight_unit: unit, price, category: category as CatalogProduct['category'] });

test('weight choices come only from the catalog and deduplicate same-unit aliases without conversion', () => {
  const rows = [product('two',2,610000), product('one',1,320000), product('alias',1,330000,'g'), product('kg',1,500000,'kg'), product('mesghal',1,900000,'مثقال')];
  const before = structuredClone(rows);
  const choices = catalogWeightChoices(rows);
  assert.equal(choices.length,4);
  assert.deepEqual(choices.filter(item=>item.unit==='گرم'),[{weight:1,unit:'گرم'},{weight:2,unit:'گرم'}]);
  assert(choices.some(item=>item.weight===1&&item.unit==='کیلوگرم'));
  assert(choices.some(item=>item.weight===1&&item.unit==='مثقال'));
  assert.deepEqual(rows,before);
  assert.deepEqual(catalogWeightChoices([]),[]);
});

test('weight filters compare both weight and unit and preserve unknown units literally', () => {
  const selected = readShopWeight('?category=نگین&weight=1.0&unit=g');
  assert(matchesShopWeight(product('a',1,1),selected));
  assert(!matchesShopWeight(product('b',1,1,'kg'),selected));
  assert(!matchesShopWeight(product('c',2,1),selected));
  assert(matchesShopWeight(product('new',2,1,'واحد تازه & +'),readShopWeight('?weight=2&unit=واحد+تازه+%26+%2B')));
  assert(matchesShopWeight(product('any',1,1),null));
});

test('invalid, partial and removed weight selections produce no matches rather than all products', () => {
  for(const search of ['weight=0&unit=گرم','weight=-1&unit=گرم','weight=Infinity&unit=گرم','weight=bad&unit=گرم','weight=1','unit=گرم','weight=&unit=','weight=999&unit=گرم']) {
    const selected=readShopWeight(search);
    assert.notEqual(selected,null);
    assert.equal(matchesShopWeight(product('a',1,320000),selected),false,search);
  }
  assert.equal(readShopWeight('category=نگین'),null);
});

test('weight URLs preserve category, comparison links and unrelated parameters; clearing only removes weight', () => {
  const href=shopWeightHref({weight:0.5,unit:'گرم'},'category=دسته+تازه+%26+%2B&utm_source=test&weight=old&weight=duplicate&unit=bad&unit=duplicate');
  const url=new URL(href,'https://example.test');
  assert.equal(url.pathname,'/shop');assert.equal(url.searchParams.get('category'),'دسته تازه & +');
  assert.equal(url.searchParams.get('utm_source'),'test');
  assert.deepEqual(url.searchParams.getAll('weight'),['0.5']);assert.deepEqual(url.searchParams.getAll('unit'),['گرم']);
  assert(matchesShopWeight(product('fraction',0.5,150000),readShopWeight(url.search)));
  const cleared=new URL(shopWeightHref(null,url.search),'https://example.test');
  assert(!cleared.searchParams.has('weight'));assert(!cleared.searchParams.has('unit'));
  assert.equal(cleared.searchParams.get('category'),'دسته تازه & +');assert.equal(cleared.searchParams.get('utm_source'),'test');
  assert.equal(shopWeightHref(null),'/shop');
});

test('unit price uses the actual pack amount and recorded mass, including fractions, zero and fresh prices', () => {
  assert.deepEqual(productUnitPrice(product('one',1,320000)),{amount:320000,unit:'گرم'});
  assert.deepEqual(productUnitPrice(product('two',2,610000)),{amount:305000,unit:'گرم'});
  assert.deepEqual(productUnitPrice(product('fraction',0.5,170000)),{amount:340000,unit:'گرم'});
  assert.deepEqual(productUnitPrice(product('zero',2,0)),{amount:0,unit:'گرم'});
  assert.deepEqual(productUnitPrice(product('updated',2,720000)),{amount:360000,unit:'گرم'});
});

test('unit price never silently converts mesghal, grams, kilograms or milligrams', () => {
  assert.deepEqual(productUnitPrice(product('mesghal',2,900000,'مثقال')),{amount:450000,unit:'مثقال'});
  assert.deepEqual(productUnitPrice(product('kg',2,900000,'kg')),{amount:450000,unit:'کیلوگرم'});
  assert.deepEqual(productUnitPrice(product('mg',500,170000,'mg')),{amount:340,unit:'میلی‌گرم'});
  assert.equal(weightUnit(' G '),'گرم');
});

test('gift pack unit prices are omitted even if mass is present', () => {
  for(const category of ['هدیه','هدیه ویژه','هدیه\u200cهای سازمانی']) assert.equal(productUnitPrice(product('gift',3,920000,'گرم',category)),null);
});

test('impossible masses, unsupported units and unsafe calculations do not generate misleading prices', () => {
  for(const weight of [0,-1,NaN,Infinity,Number.MIN_VALUE]) assert.equal(productUnitPrice(product('a',weight,610000)),null);
  assert.equal(productUnitPrice(product('unknown',1,100,'عدد')),null);
  assert.equal(productUnitPrice(product('bad-price',1,-1)),null);
  assert.deepEqual(catalogWeightChoices([product('zero',0,1),product('negative',-1,1),product('nan',NaN,1),product('blank',1,1,' ')]),[]);
});

test('category packages retain real product identities, separate equal-weight packs and never invent variants', () => {
  const current=product('current',1,320000);
  const rows=[current,product('large',2,610000),product('different-pack',1,480000),product('other',1,260000,'گرم','سرگل')];
  const packages=categoryPackages(rows,current);
  assert.deepEqual(packages.map(item=>[item.id,item.weight,item.price]),[['current',1,320000],['large',2,610000],['different-pack',1,480000]]);
  assert.equal(packages[1],rows[1]);assert.deepEqual(categoryPackages([],current),[]);
  assert.deepEqual(categoryPackages([rows[0],rows[3]],current),[current]);
});
