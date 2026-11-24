const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const origin = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
const out = path.resolve('.local/responsive');
fs.mkdirSync(out, { recursive: true });
const results = [];
async function inspect(page, label) {
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert(size.scroll <= size.width + 1, `${label}: page overflow ${JSON.stringify(size)}`);
  const dialogs = await page.locator('[data-store-dialog]:visible').all();
  for (const dialog of dialogs) {
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    assert(box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${label}: dialog out of viewport ${JSON.stringify(box)}`);
    assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${label}: dialog horizontal overflow`);
  }
  results.push({ label, ...size });
}
async function ready(page, route) {
  await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  const products = await (await fetch(origin + '/api/store/products')).json();
  assert(products.length, 'A real catalog is required for purchase flow checks');
  const contexts = [];
  const errors = [];
  for (const theme of (process.env.QA_THEMES || 'light,dark').split(',')) {
    const context = await browser.newContext({ reducedMotion: 'reduce', hasTouch: true }); contexts.push(context);
    await context.addInitScript(t => localStorage.setItem('varsa-theme-v2', t), theme);
    // No checkout submissions, login requests, or data writes in this QA run.
    await context.route('**/api/**', async route => {
      const req = route.request();
      if (req.url().endsWith('/customer/me')) return route.fulfill({ json: { customer: null } });
      if (!['GET', 'HEAD'].includes(req.method()) && !req.url().endsWith('/store/quote')) return route.fulfill({ status: 418, json: { error: 'Writes disabled in responsive QA' } });
      return route.continue();
    });
    await context.route('https://fonts.googleapis.com/**', route => route.abort());
    await context.route('https://fonts.gstatic.com/**', route => route.abort());
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    for (const [width, height] of JSON.parse(process.env.QA_VIEWPORTS || '[[320,740],[375,812],[390,844],[600,960],[768,1024],[820,1180],[1024,768],[1280,800],[1440,900],[844,390]]')) {
      await page.setViewportSize({ width, height });
      for (const route of ['/', '/shop', '/guide', '/about', '/contact', '/journal', '/guide/store-saffron', '/account', '/admin', '/missing']) {
        await ready(page, route);
        await inspect(page, `${theme} ${width}x${height} ${route}`);
        if (route === '/' && width < 1280) {
          const menu = page.getByRole('button', { name: 'منو', exact: true });
          const box = await menu.boundingBox(); assert(box.x >= 0 && box.x + box.width <= width, 'Menu button clipped');
          await menu.click(); await page.locator('#mobile-menu').waitFor();
          await inspect(page, `${theme} ${width} menu`);
          await page.getByRole('button', { name: 'بستن منو', exact: true }).click();
          await menu.waitFor({ state: 'visible' });
        }
        if (route === '/shop') {
          await page.locator('summary').click();
          await inspect(page, `${theme} ${width} comparison expanded`);
          const region = page.getByRole('region', { name: 'جدول مقایسه محصولات' });
          assert(await region.evaluate(el => el.scrollWidth > 0));
          await page.locator('summary').click();
          await page.getByRole('button', { name: 'خرید', exact: true }).first().click();
          await page.waitForURL('**/checkout/register');
          await page.getByRole('heading', { name: 'ثبت‌نام یا ورود', exact: true }).waitFor();
          await inspect(page, `${theme} ${width} checkout registration`);
          assert.equal(await page.getByRole('dialog').count(), 0);
          await page.screenshot({ path: path.join(out, `after-${theme}-${width}-checkout.png`) });
          await page.getByRole('link', { name: 'بازگشت به فروشگاه', exact: true }).click();
          await page.getByRole('button', { name: 'خرید', exact: true }).first().waitFor();
        }
        if ([320, 768, 1024, 1440].includes(width) && ['/', '/shop', '/account', '/guide/store-saffron'].includes(route)) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({ path: path.join(out, `after-${theme}-${width}-${route === '/' ? 'home' : route.split('/').pop()}.png`), fullPage: true });
        }
      }
      await ready(page, '/products/' + encodeURIComponent(products[0].slug));
      await page.locator('#product-title').waitFor();
      await inspect(page, `${theme} ${width} product`);
      const add = page.getByRole('button', { name: 'خرید محصول', exact: true });
      await add.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, `after-${theme}-${width}-product.png`) });
      const close = page.getByRole('link', { name: 'بازگشت به فهرست محصولات' });
      assert(await close.isVisible(), 'Product return link unavailable');
      await close.click();
      console.log(`PASS ${theme} ${width}x${height}`);
    }
    await context.close();
  }
  assert.deepEqual(errors, [], 'Browser runtime errors');
  fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify({ checks: results.length, errors, results }, null, 2));
  await browser.close();
  console.log(`PASS ${results.length} responsive checks`);
})().catch(e => { console.error(e); fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ error: e.stack, results }, null, 2)); process.exit(1); });

