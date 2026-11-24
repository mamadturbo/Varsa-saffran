import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPageMeta, metadataTags, renderMetadata, replaceMetadata, publicOrigin, relativeMetaPath } from '../../varsa-shop/src/lib/page-meta';
import { isPageMetadataRequest } from '../../varsa-shop/src/http-seo';
import { legacyCatalogFixture } from './catalog-fixture';
const config = { siteUrl: 'https://shop.example.test', basePath: '/store/' };
const product = legacyCatalogFixture()[0];
const article = { slug: 'راهنمای-تست', title: 'راهنمای آزمایشی زعفران', excerpt: 'توضیح همان مقاله', image_url: '/articles/test.png' };

test('preview page metadata works for browser, generic crawler and HEAD requests', () => {
  for (const accept of [undefined, '*/*', 'text/html', 'text/html,application/xhtml+xml,*/*;q=0.8']) {
    for (const method of ['GET','HEAD']) assert.equal(isPageMetadataRequest(method,accept,'/store/guide','/store/'),true);
  }
});

test('preview metadata never intercepts assets, API roots/subpaths or non-document methods', () => {
  for (const path of ['/api','/api/healthz','/store/api','/store/api/orders','/store/assets/app.js','/store/products/negin-1g.png','/store/guide/index.html']) {
    assert.equal(isPageMetadataRequest('GET','*/*',path,'/store/'),false);
  }
  assert.equal(isPageMetadataRequest('POST','text/html','/guide','/'),false);
  assert.equal(isPageMetadataRequest('GET','application/json','/guide','/'),false);
});

test('each public page has a distinct title and canonical without tracking parameters', () => {
  const pages = ['/', '/shop', '/journal', '/about', '/contact', '/guide'].map(path => buildPageMeta(path, config));
  assert.equal(new Set(pages.map(page => page.title)).size, 6);
  assert(pages.every(page => page.description && page.robots === 'index,follow'));
  assert.equal(pages[1].canonical, 'https://shop.example.test/store/shop');
  assert.equal(buildPageMeta('/shop/', config).canonical, pages[1].canonical);
  assert.equal(pages[5].canonical, 'https://shop.example.test/store/guide');
});
test('product and article metadata use their current row and valid absolute image URLs', () => {
  const p = buildPageMeta('/products/test', config, { product });
  assert.equal(p.title, `${product.name} | ورسا`); assert.equal(p.description, product.short_description);
  assert.equal(p.image, `https://shop.example.test${product.image_url}`);
  const a = buildPageMeta('/journal/test', config, { article });
  assert.equal(a.title, `${article.title} | ورسا`); assert.equal(a.type, 'article');
  assert.equal(a.description, article.excerpt); assert(a.canonical?.includes(encodeURIComponent(article.slug)));
  assert.equal(a.image, 'https://shop.example.test/articles/test.png');
});
test('admin, missing records, errors and unknown routes never advertise indexable product content', () => {
  for (const meta of [buildPageMeta('/admin', config), buildPageMeta('/not-found', config), buildPageMeta('/products/missing', config, { product: null }), buildPageMeta('/journal/missing', config, { unavailable: true })]) {
    assert(meta.robots.startsWith('noindex')); assert.equal(meta.canonical, undefined);
  }
});
test('unset domain does not invent canonical links or relative social image origins', () => {
  const meta = buildPageMeta('/');
  assert.equal(meta.canonical, undefined); assert.equal(meta.image, undefined);
  assert.equal(metadataTags(meta).some(tag => tag.attrs?.property === 'og:url'), false);
  assert.equal(publicOrigin(' '), undefined);
  for (const value of ['javascript:alert(1)', 'https://user:password@example.test', 'https://example.test/path', 'https://example.test/?x=1', 'not-a-url']) assert.throws(() => publicOrigin(value));
});
test('metadata rendering escapes database text and rejects executable image URLs', () => {
  const hostile = { ...product, name: '</title><script>alert(1)</script>', short_description: '\" onmouseover=\"alert(1)', image_url: 'javascript:alert(1)' };
  const meta = buildPageMeta('/products/test', config, { product: hostile });
  const html = renderMetadata(meta);
  assert(!html.includes('<script>')); assert(!html.includes('javascript:'));
  assert(html.includes('&lt;/title&gt;')); assert(html.includes('&quot;'));
  assert.equal(meta.image, undefined);
});
test('managed metadata replaces the previous block without duplicating tags or touching app scripts', () => {
  const template = '<html><head><!-- varsa-meta:start --><title>old</title><!-- varsa-meta:end --><script src="/app.js"></script></head></html>';
  const first = replaceMetadata(template, buildPageMeta('/shop', config));
  const updated = replaceMetadata(first, buildPageMeta('/contact', config));
  assert.equal((updated.match(/<title /g) ?? []).length, 1);
  assert.equal((updated.match(/rel="canonical"/g) ?? []).length, 1);
  assert(updated.includes('<script src="/app.js"></script>')); assert(!updated.includes('old'));
  assert.throws(() => replaceMetadata('<head></head>', buildPageMeta('/')));
});
test('metadata paths respect the storefront base and preserve escaped slugs', () => {
  assert.equal(relativeMetaPath('/store/products/50%25', '/store/'), '/products/50%25');
  assert.equal(relativeMetaPath('/storefront/shop', '/store/'), '/not-found');
});
