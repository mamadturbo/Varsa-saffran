import { mountSecurity, secureFetch, loginAdmin } from "./security-fixture";
import { migrateTest, seedTest, localS3 } from './commerce-fixture';
import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createManagementStore } from "../src/lib/management-store";
import { createManagementRouter } from "../src/lib/management-router";
import { createOrdersRouter } from "../src/lib/orders-router";
import type { ManagementState } from "@workspace/catalog";

let closeS3: (()=>Promise<void>) | undefined;
const pg = new PGlite();
const db = drizzle(pg) as unknown as Parameters<
  typeof createManagementStore
>[0];
const store = createManagementStore(db);
const app = express();
app.use(express.json({ limit: "6mb" }));
mountSecurity(app, db);
const orders = createOrdersRouter(
  db,
  async () => (await store.read()).products.filter((p) => p.active),
  store,
);
app.use("/api", createManagementRouter(db, store));
app.use("/api", orders);
let server: ReturnType<typeof app.listen>;
let base: string;
let token: string;
const original = {
  password: process.env.VARSA_ADMIN_PASSWORD,
  secret: process.env.SESSION_SECRET,
};
before(async () => {
  process.env.VARSA_ADMIN_PASSWORD = "isolated-management-password";
  process.env.SESSION_SECRET = "isolated-management-secret";
  await migrateTest(pg);
  closeS3 = await localS3();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}/api`;
  token = await loginAdmin(base, db);
});
beforeEach(async () => {
  await pg.exec('TRUNCATE commerce_products CASCADE; TRUNCATE coupons CASCADE; TRUNCATE store_config; TRUNCATE content_entries; TRUNCATE outbox; TRUNCATE stored_files');
  await pg.exec(
    "TRUNCATE orders RESTART IDENTITY CASCADE; TRUNCATE store_management; TRUNCATE store_media",
  );
  await seedTest(db);
});
after(async () => {
  if (server)
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  await closeS3?.();
  await pg.close();
  for (const [key, value] of Object.entries({
    VARSA_ADMIN_PASSWORD: original.password,
    SESSION_SECRET: original.secret,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
async function req(path: string, method = "GET", body?: unknown, auth = true) {
  const r = await secureFetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth && token ? { Cookie: token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await r.json() };
}
async function intent(extra: Record<string, unknown> = {}) {
  const s = await store.read();
  return {
    idempotencyKey: randomUUID(),
    customerName: "مشتری آزمایشی",
    phone: "09123456789",
    address: "تهران، نشانی آزمایشی",
    items: [{ productId: s.products[0].id, quantity: 1 }],
    ...extra,
  };
}
test("admin writes require login; changes persist and are visible in the public catalog", async () => {
  assert.equal(
    (await req("/admin/management", "GET", undefined, false)).status,
    401,
  );
  const s = await store.read();
  const p = { ...s.products[0], price: 500000, stock: 7 };
  assert.equal(
    (
      await req(
        `/admin/management/products/${p.id}`,
        "PUT",
        { revision: s.revision, item: p },
        false,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await req(`/admin/management/products/${p.id}`, "PUT", {
        revision: s.revision,
        item: p,
      })
    ).status,
    200,
  );
  const publicRows = await req("/store/products", "GET", undefined, false);
  assert.equal(
    publicRows.body.find((r: { id: string }) => r.id === p.id).price,
    500000,
  );
  assert.equal(
    (
      await req(`/admin/management/products/${p.id}`, "PUT", {
        revision: s.revision,
        item: p,
      })
    ).status,
    409,
  );
  assert.equal((await createManagementStore(db).read()).products[0].stock, 7);
});
test("concurrent last-unit orders cannot oversell; identical retry reserves once", async () => {
  await store.mutate(async (s) => {
    s.products[0].stock = 1;
  });
  const first = await intent();
  const second = await intent();
  const results = await Promise.all([
    req("/orders", "POST", first, false),
    req("/orders", "POST", second, false),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const winner = results[0].status === 201 ? first : second;
  assert.equal((await req("/orders", "POST", winner, false)).status, 201);
  assert.equal((await store.read()).products[0].stock, 0);
  assert.equal((await req("/admin/orders")).body.orders.length, 1);
});
test("cancellation restores stock once; reopening reserves again and stores tracking", async () => {
  await store.mutate(async (s) => {
    s.products[0].stock = 2;
  });
  const order = await req("/orders", "POST", await intent(), false);
  const path = `/admin/orders/${order.body.id}/status`;
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await req(path, "PATCH", {
          status: "cancelled",
          trackingCode: "TRACK123",
        })
      ).status,
      200,
    );
  assert.equal((await store.read()).products[0].stock, 2);
  assert.equal(
    (
      await req(path, "PATCH", {
        status: "processing",
        trackingCode: "TRACK123",
      })
    ).status,
    200,
  );
  assert.equal((await store.read()).products[0].stock, 1);
  assert.equal(
    (await req("/admin/orders")).body.orders[0].management.trackingCode,
    "TRACK123",
  );
});
test("unknown initial stock and legacy orders cannot manufacture stock on cancellation", async () => {
  const o = await req("/orders", "POST", await intent(), false);
  await store.mutate(async (s) => {
    s.products[0].stock = 5;
  });
  assert.equal(
    (
      await req(`/admin/orders/${o.body.id}/status`, "PATCH", {
        status: "cancelled",
      })
    ).status,
    200,
  );
  assert.equal((await store.read()).products[0].stock, 5);
  await store.mutate(async (s) => {
    delete s.orderMeta[o.body.id];
  });
  await req(`/admin/orders/${o.body.id}/status`, "PATCH", {
    status: "cancelled",
    trackingCode: "legacy",
  });
  await req(`/admin/orders/${o.body.id}/status`, "PATCH", {
    status: "confirmed",
  });
  assert.equal((await store.read()).products[0].stock, 5);
});
test("coupon limit and shipping are enforced atomically, retries do not consume usage", async () => {
  await store.mutate(async (s) => {
    s.coupons = [
      {
        id: randomUUID(),
        code: "VARSA10",
        kind: "percent",
        value: 10,
        minimum: 0,
        expiresAt: "",
        limit: 1,
        used: 0,
        active: true,
      },
    ];
    s.settings = {
      ...s.settings,
      shippingEnabled: true,
      shippingFee: 50000,
      freeShippingAbove: 0,
    };
  });
  const input = await intent({ couponCode: "varsa10" });
  const s = await store.read();
  const expected =
    s.products[0].price - Math.floor(s.products[0].price / 10) + 50000;
  const q = await req("/store/quote", "POST", input, false);
  assert.equal(q.body.total, expected);
  const result = await req(
    "/orders",
    "POST",
    { ...input, expectedTotal: expected },
    false,
  );
  assert.equal(result.status, 201);
  assert.equal(result.body.total, expected);
  assert.equal((await req("/orders", "POST", input, false)).status, 201);
  assert.equal((await store.read()).coupons[0].used, 1);
  assert.equal(
    (
      await req(
        "/orders",
        "POST",
        await intent({ couponCode: "VARSA10" }),
        false,
      )
    ).status,
    400,
  );
  assert.equal(
    (await req("/orders", "POST", { ...input, couponCode: "" }, false)).status,
    409,
  );
});
test("expired/minimum coupons, stale totals, hidden products and invalid URLs are rejected", async () => {
  const input = await intent();
  assert.equal(
    (await req("/orders", "POST", { ...input, expectedTotal: 1 }, false))
      .status,
    409,
  );
  await store.mutate(async (s) => {
    s.coupons = [
      {
        id: randomUUID(),
        code: "OLD",
        kind: "fixed",
        value: 100,
        minimum: 0,
        expiresAt: "2000-01-01T00:00:00Z",
        limit: 0,
        used: 0,
        active: true,
      },
    ];
  });
  assert.equal(
    (await req("/store/quote", "POST", { ...input, couponCode: "OLD" }, false))
      .status,
    400,
  );
  const s = await store.read();
  assert.equal(
    (
      await req(`/admin/management/products/${s.products[0].id}`, "PUT", {
        revision: s.revision,
        item: { ...s.products[0], image_url: "javascript:alert(1)" },
      })
    ).status,
    400,
  );
  await store.mutate(async (s) => {
    s.products[0].active = false;
  });
  assert.equal((await req("/orders", "POST", input, false)).status, 400);
});
test("articles stay private until published; settings/banners reach storefront without admin data", async () => {
  await store.mutate(async (s) => {
    s.articles = [];
  });
  let s = await store.read();
  const id = randomUUID();
  const article = {
    id,
    slug: "test-article",
    title: "مقاله آزمایشی",
    excerpt: "خلاصه",
    content: "متن مقاله",
    image_url: "/products/negin-1g.png",
    author: "ورسا",
    category: "آموزش",
    read_time: 3,
    published: false,
  };
  assert.equal(
    (
      await req(`/admin/management/articles/${id}`, "PUT", {
        revision: s.revision,
        item: article,
      })
    ).status,
    200,
  );
  let content = (await req("/store/content", "GET", undefined, false)).body;
  assert.deepEqual(content.articles, []);
  assert.equal(content.coupons, undefined);
  assert.equal(content.orderMeta, undefined);
  s = await store.read();
  await req(`/admin/management/articles/${id}`, "PUT", {
    revision: s.revision,
    item: { ...article, published: true },
  });
  s = await store.read();
  await req("/admin/management/settings/main", "PUT", {
    revision: s.revision,
    item: {
      ...s.settings,
      phone: "09123456789",
      shippingEnabled: true,
      shippingFee: 50000,
      freeShippingAbove: 100000,
    },
  });
  content = (await req("/store/content", "GET", undefined, false)).body;
  assert.equal(content.articles.length, 1);
  assert.equal(content.settings.phone, "09123456789");
  const q = await req("/store/quote", "POST", await intent(), false);
  assert.equal(q.body.shipping, 0);
});
test("writing a new article before legacy import does not hide the legacy journal", async () => {
  const s = await store.read();
  const id = randomUUID();
  assert.equal(s.articles, null);
  const result = await req(`/admin/management/articles/${id}`, "PUT", {
    revision: s.revision,
    item: {
      id,
      slug: "new-without-import",
      title: "مقاله جدید",
      excerpt: "خلاصه",
      content: "متن",
      image_url: "/products/negin-1g.png",
      author: "ورسا",
      category: "آموزش",
      read_time: 2,
      published: true,
    },
  });
  assert.equal(result.status, 200);
  const content = (await req("/store/content", "GET", undefined, false)).body;
  assert.equal(content.useLegacyArticles, true);
  assert.equal(content.articles[0].slug, "new-without-import");
});

test("management migration is repeatable and denies public-role access", async () => {
  await pg.exec(
    await readFile(
      new URL(
        "../../../lib/db/migrations/0003_store_management.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const result = await pg.query<{ relrowsecurity: boolean }>(
    "SELECT relrowsecurity FROM pg_class WHERE relname IN ('store_management','store_media')",
  );
  assert.equal(result.rows.length, 2);
  assert(result.rows.every((r) => r.relrowsecurity));
  assert.equal((await store.read()).products.length, 12);
});

test("image uploads require authentication and validate file type; bytes persist", async () => {
  const image = {
    mime: "image/png",
    data: "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVQImWP4v5vh/24GEP6/mwEANGIG6cZZZQ8AAAAASUVORK5CYII=",
  };
  assert.equal((await req("/admin/media", "POST", image, false)).status, 401);
  assert.equal(
    (
      await req("/admin/media", "POST", {
        mime: "image/png",
        data: "bm90LWFuLWltYWdl",
      })
    ).status,
    400,
  );
  const saved = await req("/admin/media", "POST", image);
  assert.equal(saved.status, 201);
  const media = await fetch(base.replace(/\/api$/, "") + saved.body.url);
  assert.equal(media.status, 200);
  assert.equal(media.headers.get("content-type"), "image/webp");
  assert.deepEqual(
    Buffer.from(await media.arrayBuffer()),
    (await import("../src/modules/files/storage")).encodeUpload ? (await (await import("../src/modules/files/storage")).encodeUpload(image.data,image.mime)).bytes : Buffer.alloc(0),
  );
});

test('an old admin stock form cannot overwrite a concurrent sale',async()=>{
  await store.mutate(async s=>{s.products[0].stock=2;});
  const state=await store.read(),product=state.products[0];
  assert.equal((await req('/orders','POST',await intent(),false)).status,201);
  const stale=await req(`/admin/management/products/${product.id}`,'PUT',{revision:state.revision,item:{...product,stock:5}});
  assert.equal(stale.status,409);
  assert.equal((await store.read()).products[0].stock,1);
});


