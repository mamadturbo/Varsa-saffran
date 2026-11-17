import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPageMeta, metadataTags, renderMetadata, replaceMetadata } from '../../varsa-shop/src/lib/page-meta';
import { buildProductJsonLd, serializeJsonLd } from '../../varsa-shop/src/lib/product-jsonld';
import { resolvePageMeta } from '../../varsa-shop/src/lib/meta-data';
import { legacyCatalogFixture } from './catalog-fixture';
const product = legacyCatalogFixture()[0];
const config = { siteUrl: 'https://shop.example.test', basePath: '/store/' };
function jsonFromHtml(html: string) {
  const match = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  assert(match); return JSON.parse(match[1]);
}
test('product schema uses canonical identity, exact catalog fields and rial price', () => {
  const meta = buildPageMeta(`/products/${product.slug}`, config, { product });
  const data = jsonFromHtml(renderMetadata(meta));
  assert.equal(data['@context'], 'https://schema.org'); assert.equal(data['@type'], 'Product');
  assert.equal(data.name, product.name); assert.equal(data.sku, product.id);
  assert.equal(data.category, product.category); assert.equal(data.brand.name, 'ورسا');
  assert.equal(data.url, `https://shop.example.test/store/products/${product.slug}`);
  assert.equal(data['@id'], `${data.url}#product`); assert.equal(data.offers.url, data.url);
  assert.equal(data.offers.priceCurrency, 'IRR'); assert.equal(data.offers.price, '4490000');
  assert.equal(product.price, 449000); assert.equal(data.image[0], `https://shop.example.test${product.image_url}`);
  assert.deepEqual(data.weight, { '@type': 'QuantitativeValue', value: 1, unitText: 'گرم' });
});
test('schema does not invent stock, ratings, shipping, returns or price expiry', () => {
  const data = buildPageMeta(`/products/${product.slug}`, config, { product }).structuredData!;
  assert.equal(Object.hasOwn(data, 'aggregateRating'), false); assert.equal(Object.hasOwn(data, 'review'), false);
  for (const key of ['availability', 'shippingDetails', 'hasMerchantReturnPolicy', 'priceValidUntil', 'itemCondition']) assert.equal(Object.hasOwn(data.offers, key), false);
});
test('price conversion covers free and maximum catalog values and rejects malformed amounts', () => {
  for (const [price, expected] of [[0, '0'], [1, '10'], [320000, '3200000'], [2147483647, '21474836470']] as const) assert.equal(buildProductJsonLd({ ...product, price }, { description: 'test' })?.offers.price, expected);
  for (const price of [-1, 1.5, NaN, Infinity, 2147483648]) assert.equal(buildProductJsonLd({ ...product, price }, { description: 'test' }), undefined);
});
test('unknown, unloaded, missing and non-product pages contain no Product JSON-LD', () => {
  for (const meta of [buildPageMeta('/shop', config), buildPageMeta('/admin', config), buildPageMeta('/contact', config), buildPageMeta('/journal/example', config), buildPageMeta('/products/example', config), buildPageMeta('/products/example', config, { product: null }), buildPageMeta('/products/example', config, { unavailable: true })]) assert(!renderMetadata(meta).includes('application/ld+json'));
});
test('domain/image/weight omissions stay omissions instead of fabricated values', () => {
  const meta = buildPageMeta(`/products/${product.slug}`, {}, { product: { ...product, weight: -1 } });
  const data = meta.structuredData!;
  assert.equal(data.url, undefined); assert.equal(data['@id'], undefined); assert.equal(data.offers.url, undefined);
  assert.equal(data.image, undefined); assert.equal(data.weight, undefined);
  const mesghal = buildProductJsonLd({ ...product, weight_unit: 'مثقال' }, { description: 'test' })!;
  assert.equal(mesghal.weight?.unitText, 'مثقال'); assert.equal(mesghal.weight?.value, product.weight);
  assert.equal(buildProductJsonLd({ ...product, weight_unit: 'بسته' }, { description: 'test' })!.weight, undefined);
});
test('JSON-LD serialization prevents script breakout while preserving original parsed data', () => {
  const name = '</script><script>alert("x")</script>&\u2028x\u2029y';
  const meta = buildPageMeta(`/products/${product.slug}`, config, { product: { ...product, name } });
  const script = metadataTags(meta).find(tag => tag.tag === 'script')!;
  assert(!script.text!.includes('<')); assert(!script.text!.includes('&'));
  assert.equal(JSON.parse(script.text!).name, name);
  assert.equal((renderMetadata(meta).match(/<script /g) ?? []).length, 1);
  assert.equal(JSON.parse(serializeJsonLd(meta.structuredData!)).name, name);
});
test('replacing route metadata removes the previous product schema', () => {
  const template = '<head><!-- varsa-meta:start --><!-- varsa-meta:end --></head>';
  const productHtml = replaceMetadata(template, buildPageMeta(`/products/${product.slug}`, config, { product }));
  assert(productHtml.includes('application/ld+json'));
  const contact = replaceMetadata(productHtml, buildPageMeta('/contact', config));
  assert(!contact.includes('application/ld+json')); assert(!contact.includes(product.slug));
});
test('live resolver picks current price and never falls back to old schema after deletion/outage', async () => {
  let rows = [product]; let down = false;
  const source = { ...config, url: 'https://catalog.example.test', anonKey: 'public-test', fetch: async () => down ? new Response('', { status: 503 }) : new Response(JSON.stringify(rows), { status: 200 }) };
  const route = `/products/${product.slug}`;
  assert.equal((await resolvePageMeta(route, source)).structuredData?.offers.price, '4490000');
  rows = [{ ...product, price: 555000 }];
  assert.equal((await resolvePageMeta(route, source)).structuredData?.offers.price, '5550000');
  rows = []; assert.equal((await resolvePageMeta(route, source)).structuredData, undefined);
  down = true; assert.equal((await resolvePageMeta(route, source)).structuredData, undefined);
});
