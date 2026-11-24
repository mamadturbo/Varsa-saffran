import assert from "node:assert/strict";
import { createServer, type RequestListener } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import {
  createSeoHandler,
  indexingConfig,
} from "../../varsa-shop/src/http-seo";
import { legacyCatalogFixture } from "./catalog-fixture";
import {
  configureMeasurement,
  connectMeasurement,
  measureCommerce,
  measurePage,
} from "../../varsa-shop/src/lib/analytics";

async function listen(handler: RequestListener) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  };
}

const template =
  "<!doctype html><html><head><!-- varsa-meta:start --><!-- varsa-meta:end --></head><body><!--varsa-app--><!--varsa-data--></body></html>";
const record = {
  id: "a",
  slug: "راهنمای-تست",
  title: "راهنمای آزمایشی زعفران",
  excerpt: "خلاصه",
  content: "متن مقاله",
  image_url: "/photos/test.webp",
  author: "ورسا",
  category: "راهنما",
  read_time: 2,
  created_at: "2026-01-01T00:00:00Z",
};
const row = legacyCatalogFixture()[0];

test("HTML requests use current public rows, distinguish 404 from 503, and share an accurate sitemap", async () => {
  let products: (typeof row)[] | null = [{ ...row, stock: 4 }];
  let partial = false;
  let reads = 0;
  const requests: Array<{
    path?: string;
    cookie?: string;
    authorization?: string;
  }> = [];
  const upstream = await listen((req, res) => {
    requests.push({
      path: req.url,
      cookie: req.headers.cookie,
      authorization: req.headers.authorization,
    });
    res.setHeader("Content-Type", "application/json");
    switch (req.url) {
      case "/api/store/products":
        reads++;
        if (!products) {
          res.writeHead(503).end("{}");
          return;
        }
        res.end(JSON.stringify(products));
        return;
      case "/api/articles":
        if (partial) res.setHeader("X-Varsa-Articles-Partial", "1");
        res.end(
          JSON.stringify([
            record,
            { ...record, slug: "draft", published: false },
            { ...record, slug: "saffron-health-benefits" },
          ]),
        );
        return;
      case "/api/store/content":
        res.end(
          JSON.stringify({
            banners: [],
            settings: {},
            contact_messages: ["internal-canary"],
          }),
        );
        return;
      default:
        res.writeHead(404).end("{}");
    }
  });
  let handle: ReturnType<typeof createSeoHandler>;
  const site = await listen((req, res) => {
    void handle(req, res, () => res.writeHead(404).end());
  });
  const siteUrl = site.origin.replace("http:", "https:");
  handle = createSeoHandler({
    apiOrigin: upstream.origin,
    siteUrl,
    indexable: true,
    template: async () => template,
    render: () => "<main></main>",
  });
  const get = (path: string, options?: RequestInit) =>
    fetch(site.origin + path, { redirect: "manual", ...options });
  try {
    const productPath = `/products/${row.slug}`;
    const response = await get(productPath, {
      headers: { Cookie: "private-canary=1", Authorization: "private-canary" },
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /"price":"4490000"/);
    assert.match(html, /"availability":"https:\/\/schema.org\/InStock"/);
    assert(html.includes(`href="${siteUrl}${productPath}"`));
    assert(!html.includes("canary"));
    assert(
      requests.every((request) => !request.cookie && !request.authorization),
    );
    assert.equal(reads, 1);

    const sitemap = await get("/sitemap.xml");
    const xml = await sitemap.text();
    assert.equal(sitemap.status, 200);
    assert(
      xml.includes(productPath) && xml.includes("/categories/super-negin"),
    );
    assert(xml.includes(encodeURIComponent(record.slug)));
    assert(
      !xml.includes("draft") &&
        !xml.includes("saffron-health-benefits") &&
        !xml.includes("/admin"),
    );
    assert.equal((await get("/journal/draft")).status, 404);
    assert.match(
      (await get("/journal/saffron-health-benefits")).headers.get(
        "x-robots-tag",
      )!,
      /^noindex/,
    );
    assert(
      (await (await get("/robots.txt")).text()).includes(
        `Sitemap: ${siteUrl}/sitemap.xml`,
      ),
    );
    assert.equal(
      (await get("/shop/?x=1")).headers.get("location"),
      "/shop?x=1",
    );
    assert.equal(await (await get("/shop", { method: "HEAD" })).text(), "");

    products = [{ ...row, price: 555000, stock: 0 }];
    const updated = await (await get(productPath)).text();
    assert.match(updated, /"price":"5550000"/);
    assert.match(updated, /OutOfStock/);
    products = [];
    assert.equal((await get(productPath)).status, 404);
    assert.equal((await get("/categories/super-negin")).status, 404);
    products = null;
    const outage = await get(productPath);
    assert.equal(outage.status, 503);
    assert.equal(outage.headers.get("retry-after"), "60");
    assert.match(outage.headers.get("x-robots-tag")!, /^noindex/);
    assert.equal((await get("/about")).status, 200);
    assert.equal((await get("/sitemap.xml")).status, 503);

    partial = true;
    products = [row];
    assert.equal((await get("/journal/missing")).status, 503);
    assert.equal(
      (await get(`/journal/${encodeURIComponent(record.slug)}`)).status,
      200,
    );
    assert.equal((await get("/sitemap.xml")).status, 503);

    const requestCount = requests.length;
    assert.equal(
      (await get("/admin")).headers.get("x-robots-tag"),
      "noindex,nofollow",
    );
    assert.equal(
      (await get("/account")).headers.get("x-robots-tag"),
      "noindex,nofollow",
    );
    assert.equal(
      (await get("/payment/10")).headers.get("x-robots-tag"),
      "noindex,nofollow",
    );
    assert.equal(requests.length, requestCount);
  } finally {
    await site.close();
    await upstream.close();
  }
});

test("indexing requires explicit enablement and a matching HTTPS site origin", () => {
  for (const url of [undefined, "http://varsa.example.test"])
    assert.throws(() => indexingConfig(url, true));
  assert.equal(
    indexingConfig("https://varsa.example.test", false, "varsa.example.test")
      .indexable,
    false,
  );
  assert.equal(
    indexingConfig("https://varsa.example.test", true, "preview.example.test")
      .indexable,
    false,
  );
  assert.equal(
    indexingConfig("https://varsa.example.test", true, "varsa.example.test")
      .indexable,
    true,
  );
});

test("measurement honors consent and origin, and sends only public commerce fields", (t) => {
  const origin = "https://varsa.example.test";
  for (const [key, value] of Object.entries({
    location: { origin: "https://preview.example.test" },
    document: { referrer: "https://chatgpt.com/search?private=value" },
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  let consent = true;
  const received: unknown[] = [];
  const disconnect = connectMeasurement({
    consent: () => consent,
    send: (event) => received.push(event),
  });
  t.after(disconnect);
  const product = [{ product: row, quantity: 2 }];

  configureMeasurement(origin, true);
  measureCommerce("add_to_cart", product);
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { origin },
  });
  configureMeasurement(origin, false);
  measureCommerce("add_to_cart", product);
  configureMeasurement(origin, true);
  consent = false;
  measurePage(origin + "/shop", true);
  assert.deepEqual(received, []);

  consent = true;
  measurePage(origin + "/shop", true);
  measureCommerce("order_request_submitted", product);
  assert.deepEqual(received, [
    {
      name: "page_view",
      page_location: origin + "/shop",
      ai_source: "chatgpt.com",
    },
    {
      name: "order_request_submitted",
      currency: "IRR",
      value: row.price * 20,
      items: [
        {
          item_id: row.id,
          item_name: row.name,
          item_category: row.category,
          price: row.price * 10,
          quantity: 2,
        },
      ],
    },
  ]);
});
