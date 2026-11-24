"""Browser smoke test against a local storefront backed by a public fixture catalog."""

import argparse
import json
from pathlib import Path
from urllib.parse import quote, urlencode, urlparse

from playwright.sync_api import expect, sync_playwright


def run(browser, origin, axe_path):
    api = browser.new_context(java_script_enabled=False)
    page = api.new_page()
    products = api.request.get(origin + "/api/store/products").json()
    articles = api.request.get(origin + "/api/articles").json()
    product = next(item for item in products if item.get("stock") != 0)
    product_path = "/products/" + quote(product["slug"], safe="")

    paths = ["/", "/shop", "/guide", "/journal", "/about", "/contact", product_path,
             "/guide/brew-saffron", "/guide/store-saffron", "/guide/check-saffron"]
    representative_paths = [
        f"/products/{item['slug']}" for item in products
        if item["slug"] in ("negin-1-mesghal", "super-negin-1-mesghal", "poshal-1-mesghal")
        and f"/products/{item['slug']}" != product_path
    ]
    paths.extend(representative_paths)
    if articles:
        paths.append("/journal/" + quote(articles[0]["slug"], safe=""))
    titles = set()
    for path in paths:
        assert page.goto(origin + path).status == 200, path
        expect(page.locator("html")).to_have_attribute("lang", "fa-IR")
        expect(page.locator("html")).to_have_attribute("dir", "rtl")
        expect(page.locator("main h1")).to_be_visible()
        expect(page.locator('meta[name="description"]')).to_have_count(1)
        titles.add(page.title())
    assert len(titles) == len(paths)
    page.goto(origin + "/shop")
    expect(page.locator(f'main article a[href="{product_path}"]').first).to_be_visible()
    page.goto(origin + product_path)
    expect(page.locator("main")).to_contain_text(product["name"])
    expect(page.locator("main")).to_contain_text("تومان")
    expect(page.locator('nav[aria-label="مسیر صفحه"]')).to_be_visible()
    category = "/categories/negin"
    assert page.goto(origin + category + "?weight=1&unit=" + quote("گرم")).status == 200
    assert page.locator('main article a[href^="/products/"]').count()
    for step in ("register", "cart", "shipping", "review"):
        response = page.goto(origin + "/checkout/" + step)
        assert response.status == 200
        assert response.headers["x-robots-tag"] == "noindex,nofollow"
    for path in ("/missing", "/products/nonexistent", "/journal/nonexistent", "/categories/nonexistent"):
        response = page.goto(origin + path)
        assert response.status == 404, path
        assert response.headers["x-robots-tag"].startswith("noindex")
    api.close()

    accessibility = {}
    console_errors = []
    responsive_paths = [
        "/", "/shop", product_path, "/guide/store-saffron", "/account", "/admin",
        "/about", "/contact", "/guide", *representative_paths,
    ]
    for width, height in ((320, 740), (390, 844), (768, 1024), (1440, 900)):
        context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
        page = context.new_page()
        page.on("pageerror", lambda error: console_errors.append(str(error)))
        page.on("console", lambda message: console_errors.append(message.text)
                if message.type == "error" and any(word in message.text.lower() for word in ("hydrat", "minified react")) else None)
        for path in responsive_paths:
            response = page.goto(origin + path)
            assert response.status == 200
            page.wait_for_load_state("networkidle")
            assert page.locator("html").evaluate("e => e.scrollWidth <= innerWidth + 1"), (width, path)
            if path in ("/account", "/admin"):
                assert response.headers["x-robots-tag"] == "noindex,nofollow"
            if axe_path and width == 390 and path not in ("/account", "/admin"):
                page.evaluate(Path(axe_path).read_text(encoding="utf-8"))
                violations = page.evaluate("""async () => {
                  const audit = await axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
                  return audit.violations.map(rule => ({ rule: rule.id, targets: rule.nodes.map(node => node.target) }));
                }""")
                accessibility[path] = violations
        context.close()

    # The browser runs the real storefront. All order-related responses are
    # isolated fixtures, so this check cannot write an order or upload a receipt.
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
    writes = []
    total = product["price"]
    phone = "09121234567"
    customer = {"id": "checkout-fixture", "phone": phone,
                "profile": {"name": "", "addresses": [], "favorites": []}}
    signed_in = False
    def api_mock(route):
        nonlocal signed_in
        request = route.request
        path = urlparse(request.url).path
        if path == "/api/csrf":
            route.fulfill(json={"csrfToken": "browser-test-fixture"})
        elif path == "/api/customer/me":
            route.fulfill(json={"customer": customer if signed_in else None})
        elif path == "/api/customer/auth/request" and request.method == "POST":
            assert request.post_data_json == {"phone": phone}
            route.fulfill(json={"phone": phone, "retryAfter": 30, "developmentCode": "123456"})
        elif path == "/api/customer/auth/verify" and request.method == "POST":
            assert request.post_data_json == {"phone": phone, "code": "123456"}
            signed_in = True
            route.fulfill(json={"customer": customer})
        elif path == "/api/store/quote" and request.method == "POST":
            route.fulfill(json={"subtotal": total, "discount": 0, "shipping": 0, "total": total,
                                "couponCode": "", "shippingConfigured": True})
        elif path == "/api/orders" and request.method == "POST":
            writes.append(request.post_data_json)
            route.fulfill(status=201, json={"id": "1", "orderNumber": "TEST-1", "status": "pending",
                                           "total": total, "createdAt": "2026-11-17T00:00:00Z"})
        elif path == "/api/orders/1/payment" and request.method == "GET":
            assert request.headers["x-order-key"] == writes[0]["idempotencyKey"]
            route.fulfill(json={"order": {"id": "1", "orderNumber": "TEST-1", "total": total, "status": "pending"},
                                "paymentStatus": "unpaid", "shippingConfigured": True,
                                "config": {"enabled": False}, "receipt": None})
        elif request.method in ("GET", "HEAD"):
            route.continue_()
        else:
            route.fulfill(status=418)

    ctx.route("**/api/**", api_mock)
    page = ctx.new_page()
    page.on("pageerror", lambda error: console_errors.append(str(error)))
    filtered = "/shop?" + urlencode({"category": product["category"]})
    page.goto(origin + filtered)
    page.wait_for_load_state("networkidle")
    page.get_by_role("link", name=f"جزئیات {product['name']}", exact=True).click()
    expect(page.locator("#product-title")).to_have_text(product["name"])
    assert urlparse(page.url).path == product_path
    page.go_back()
    expect(page.get_by_role("link", name=f"جزئیات {product['name']}", exact=True)).to_be_visible()
    page.go_forward()
    expect(page.locator("#product-title")).to_be_visible()
    def expect_step(path, heading):
        expect(page).to_have_url(origin + path)
        expect(page.get_by_role("heading", level=1, name=heading)).to_be_visible()
        expect(page.get_by_role("dialog")).to_have_count(0)
        assert page.locator("html").evaluate("e => e.scrollWidth <= innerWidth + 1")

    page.get_by_role("button", name="خرید محصول", exact=True).click()
    expect_step("/checkout/register", "ثبت‌نام یا ورود")
    login_card = page.locator(".vc-login")
    assert login_card.evaluate("el => Math.abs(el.getBoundingClientRect().left + el.offsetWidth / 2 - document.documentElement.clientWidth / 2) < 2")
    phone_input = page.get_by_label("شماره موبایل", exact=True)
    assert phone_input.evaluate("el => parseFloat(getComputedStyle(el).fontSize)") >= 16
    phone_input.fill(phone)
    page.get_by_role("button", name="دریافت کد ورود", exact=True).click()
    page.get_by_label("کد شش‌رقمی").fill("123456")
    page.get_by_role("button", name="تأیید و ورود", exact=True).click()
    expect_step("/checkout/cart", "سبد خرید")
    expect(page.locator("main")).to_contain_text(product["name"])
    page.get_by_role("button", name="ادامه به اطلاعات ارسال").click()
    expect_step("/checkout/shipping", "اطلاعات ارسال")
    page.locator("#ck-name").fill("مشتری آزمایشی")
    expect(page.locator("#ck-phone")).to_have_value(phone)
    address = "نشانی آزمایشی برای آزمون محلی فروشگاه ورسا"
    page.locator("#ck-address").fill(address)
    page.get_by_role("button", name="ادامه به بازبینی سفارش").click()
    expect_step("/checkout/review", "بازبینی سفارش")
    page.get_by_role("button", name="ویرایش سبد خرید").click()
    expect_step("/checkout/cart", "سبد خرید")
    page.go_back()
    expect_step("/checkout/review", "بازبینی سفارش")
    page.get_by_role("button", name="ویرایش اطلاعات ارسال").click()
    expect(page.locator("#ck-address")).to_have_value(address)
    page.get_by_role("button", name="ادامه به بازبینی سفارش").click()
    page.get_by_role("button", name="ثبت سفارش و ادامه به پرداخت").click()
    expect_step("/payment/1", "پرداخت و پیگیری رسید")
    expect(page.get_by_text("TEST-1", exact=True)).to_be_visible()
    assert len(writes) == 1
    assert writes[0]["expectedTotal"] == total
    assert writes[0]["items"] == [{"productId": product["id"], "quantity": 1}]
    assert writes[0]["phone"] == phone
    assert writes[0]["address"] == address
    expect(page.locator('meta[name="robots"]')).to_have_attribute("content", "noindex,nofollow")
    page.reload()
    expect(page.get_by_text("TEST-1", exact=True)).to_be_visible()

    page.set_viewport_size({"width": 1440, "height": 900})
    page.get_by_role("link", name="ادامه خرید", exact=True).click()
    page.get_by_role("link", name="سبد خرید", exact=True).click()
    expect_step("/checkout/cart", "سبد خرید")
    expect(page.get_by_text("سبد خرید شما خالی است")).to_be_visible()
    page.get_by_role("link", name="مشاهده فروشگاه", exact=True).click()
    page.get_by_role("button", name="خرید", exact=True).first.click()
    expect_step("/checkout/cart", "سبد خرید")
    page.get_by_role("button", name="ادامه به اطلاعات ارسال").click()
    expect_step("/checkout/shipping", "اطلاعات ارسال")
    expect(page.locator("#ck-phone")).to_have_value(phone)
    ctx.close()
    assert not console_errors, console_errors
    print(json.dumps({"html_without_js": len(paths), "mobile_tablet_desktop": len(responsive_paths) * 4,
                      "checkout_fixture": True, "page_errors": console_errors,
                      "accessibility": accessibility}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--origin", default="http://127.0.0.1:5182")
    parser.add_argument("--axe", help="Optional path to axe.min.js")
    args = parser.parse_args()
    assert urlparse(args.origin).hostname in ("localhost", "127.0.0.1"), "Local browser fixture required"
    with sync_playwright() as playwright:
        with playwright.chromium.launch(channel="chrome", headless=True) as browser:
            run(browser, args.origin.rstrip("/"), args.axe)
