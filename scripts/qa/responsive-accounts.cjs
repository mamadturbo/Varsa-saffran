const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173';
fs.mkdirSync('.local/responsive', { recursive: true });
(async () => {
  const products = await (await fetch(base + '/api/store/products')).json();
  const content = await (await fetch(base + '/api/store/content')).json();
  const customer = { id: 'responsive-qa', phone: '09120000000', profile: { name: 'کاربر آزمایشی بررسی ریسپانسیو با نام بلند', email: 'responsive-qa@example.test', favorites: products.slice(0, 3).map(p => p.id), addresses: [{ id: 'address-test', label: 'نشانی نمونه', recipient: 'کاربر آزمایشی', phone: '09120000000', province: 'تهران', city: 'تهران', address: 'نشانی طولانی آزمایشی برای بررسی نمایش در صفحه کوچک', postalCode: '1234567890', isDefault: true }], smsUpdates: false } };
  const order = { id: 1, orderNumber: 'V-QA-1234567890', customerName: customer.profile.name, phone: customer.phone, address: customer.profile.addresses[0].address, status: 'processing', paymentStatus: 'unpaid', total: 123456789, createdAt: new Date().toISOString(), items: products.slice(0, 3).map(p => ({ productId: p.id, name: p.name, productName: p.name, imageUrl: p.image_url, price: p.price, quantity: 2, total: p.price * 2 })), management: { subtotal: 123456789, discount: 0, shipping: 0, total: 123456789, couponCode: '', shippingConfigured: false, trackingCode: '', reserved: false } };
  const state = { revision: 1, products, articles: [], banners: content.banners, coupons: [], settings: content.settings, orderMeta: {} };
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const errors = [], results = [];
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await context.route('**/api/**', async route => {
    const req = route.request(), endpoint = new URL(req.url()).pathname;
    if (req.method() !== 'GET') return route.fulfill({ status: 418, json: { error: 'QA writes disabled' } });
    const fixtures = {
      '/api/customer/me': { customer }, '/api/customer/dashboard': { customer, orders: [order], cases: [], notifications: [], reviews: [], returnWindowDays: 7 },
      '/api/admin/session': { authenticated: true, enrollmentRequired: false }, '/api/admin/management': state,
      '/api/admin/orders': { orders: [order] }, '/api/admin/customer-service': { customers: [customer], cases: [], reviews: [], notifications: [] }
    };
    if (endpoint in fixtures) return route.fulfill({ json: fixtures[endpoint] });
    return route.continue();
  });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  const check = async label => {
    const data = await page.evaluate(() => ({ w: innerWidth, scroll: document.documentElement.scrollWidth,
      offenders: [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1) && !el.closest('.adm-chart-scroll, .vc-sidebar nav'); }).slice(0, 12).map(el => ({ tag: el.tagName, cls: String(el.className).slice(0, 120), rect: el.getBoundingClientRect().toJSON() })) }));
    if (data.scroll > data.w + 1) {
      console.log(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => { const r=el.getBoundingClientRect();return r.width && r.right > innerWidth+1; }).map(el => ({ cls:String(el.className).slice(0,100), tag:el.tagName, rect:el.getBoundingClientRect().toJSON() }))));
      await page.screenshot({path:'.local/responsive/accounts-failure.png',fullPage:true});
    }
    assert(data.scroll <= data.w + 1, label + JSON.stringify(data));
    for (const dialog of await page.locator('[data-store-dialog]:visible').all()) {
      const box = await dialog.boundingBox(), v = page.viewportSize();
      assert(box.x >= -1 && box.y >= -1 && box.x + box.width <= v.width + 1 && box.y + box.height <= v.height + 1, label + ': dialog bounds');
      assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), label + ': dialog horizontal overflow');
    }
    results.push({ label, ...data });
    fs.writeFileSync(".local/responsive/account-admin-progress.json", JSON.stringify(results, null, 2));
  };
  for (const [width, height] of JSON.parse(process.env.QA_VIEWPORTS || '[[320,740],[390,844],[768,1024],[1024,768],[844,390],[1440,900]]')) {
    await page.setViewportSize({ width, height });
    for (const view of (process.env.QA_SCOPE === 'admin' ? [] : ['overview', 'orders', 'addresses', 'favorites', 'support', 'reviews', 'notifications', 'profile'])) {
      await page.goto(base + '/account?view=' + view, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle');
      await page.locator('.vc-content').waitFor(); await check(`${width} account ${view}`);
      if (view === 'overview' && width < 640) {
        const row = page.locator('.vc-order-row').first();
        const price = await row.locator('.vc-order-price').boundingBox();
        const status = await row.locator('.vc-status').boundingBox();
        assert(price.y >= status.y + status.height, 'Order amount overlaps status');
      }
      if (view === 'overview') {
        if (width >= 1024) {
          const rail = page.locator('.vc-sidebar-desktop');
          const first = await rail.boundingBox();
          assert(Math.abs(first.x + first.width - width) < 2, 'Account rail must meet right edge');
          assert(Math.abs(first.y - 80) < 2, 'Account rail must begin below header');
          await page.evaluate(() => window.scrollTo(0, 350));
          const scrolled = await rail.boundingBox(); assert(Math.abs(first.y - scrolled.y) < 1, 'Account sidebar must remain fixed');
          await page.evaluate(() => window.scrollTo(0, 0));
        } else {
          const trigger = page.getByRole('button', {name:'بخش‌های حساب',exact:true});
          await trigger.click(); await page.locator('#account-navigation').waitFor();
          await check(`${width} customer menu`);
          for(let i=0;i<12;i++){ await page.keyboard.press('Tab'); assert(await page.evaluate(()=>!!document.activeElement.closest('#account-navigation')), 'Account menu focus escaped'); }
          await page.keyboard.press('Escape'); await page.locator('#account-navigation').waitFor({state:'hidden'});
          assert(await trigger.evaluate(el=>el===document.activeElement), 'Account menu focus restoration');
        }
      }
      if (view === 'overview' || view === 'profile') await page.screenshot({ path: `.local/responsive/account-${width}-${view}.png`, fullPage: true });
      if (view === 'addresses') {
        await page.getByRole('button', { name: 'ویرایش آدرس', exact: true }).click();
        await page.locator('.vc-sheet').waitFor(); await check(`${width} address sheet`);
        await page.locator('.vc-sheet').getByRole('button', { name: 'بستن', exact: true }).click();
      }
    }
    for (const section of (process.env.QA_SCOPE === 'customer' ? [] : ['overview', 'orders', 'products', 'customers', 'service', 'coupons', 'articles', 'banners', 'settings'])) {
      await page.goto(base + '/admin?section=' + section, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle');
      await page.locator('.admin-shell').waitFor(); await check(`${width} admin ${section}`);
      if (section === 'overview' || section === 'products') await page.screenshot({ path: `.local/responsive/admin-${width}-${section}.png`, fullPage: true });
      if (section === 'overview' && width <= 760) {
        const trigger = page.getByRole('button', { name: 'باز کردن منو', exact: true });
        await trigger.click(); await page.locator('#management-menu').waitFor();
        await check(`${width} admin menu`);
        await page.keyboard.press('Escape');
        await page.locator('#management-menu').waitFor({ state: 'hidden' });
        assert(await trigger.evaluate(el => el === document.activeElement), 'Admin menu did not restore focus');
      }
      if (section === 'products') {
        await page.getByRole('button', { name: 'افزودن محصول', exact: true }).click();
        await page.locator('.adm-editor').waitFor(); await check(`${width} product editor`);
        await page.locator('.adm-editor').getByRole('button', { name: 'بستن', exact: true }).click();
      }
    }
    console.log('PASS authenticated fixtures', width);
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync('.local/responsive/account-admin-checks.json', JSON.stringify({ checks: results.length, errors, results }, null, 2));
  await browser.close(); console.log('PASS', results.length, 'account/admin checks');
})().catch(e => { console.error(e); process.exit(1); });

