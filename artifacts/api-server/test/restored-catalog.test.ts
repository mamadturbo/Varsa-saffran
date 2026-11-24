import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { getRestoredCatalog } from "@workspace/catalog";
import { loadOrderCatalog } from "../src/lib/catalog";
import { createOrderHandler } from "../src/lib/create-order";
import { publicProducts } from "../../varsa-shop/src/lib/public-page";
import { PRODUCT_VARIANTS } from "./legacy-catalog";

test("restored catalog exactly matches the original twelve names, weights, prices and images", async () => {
  const products = getRestoredCatalog();
  assert.equal(products.length, 12);
  assert.equal(new Set(products.map((p) => p.id)).size, 12);
  assert.equal(new Set(products.map((p) => p.slug)).size, 12);
  for (const v of PRODUCT_VARIANTS) {
    const product = products.find((p) => p.slug === v.slug)!;
    assert(product);
    assert.equal(product.name, `زعفران ${v.category} ورسا ${v.label}`);
    assert.equal(product.weight, v.weight);
    assert.equal(product.weight_unit, v.weightUnit);
    assert.equal(product.price, v.price);
    assert.equal(product.image_url, `/products/${v.image}`);
    await readFile(
      new URL(`../../varsa-shop/public/products/${v.image}`, import.meta.url),
    );
    for (const width of [160, 320, 640, 960, 1254])
      await readFile(
        new URL(
          `../../varsa-shop/public/products/${v.slug}-${width}.webp`,
          import.meta.url,
        ),
      );
  }
  assert.equal(products.filter((p) => p.is_featured).length, 4);
  assert.deepEqual(
    [...new Set(products.map((p) => p.category))],
    ["سوپر نگین", "نگین", "شبه نگین", "پوشال"],
  );
  products[0].price = 1;
  assert.equal(getRestoredCatalog()[0].price, 449000);
});

test("restored server catalog and projected storefront records preserve product data and subfolder assets", async () => {
  assert.deepEqual(await loadOrderCatalog(), getRestoredCatalog());
  assert.deepEqual(
    JSON.parse(JSON.stringify(publicProducts(getRestoredCatalog("/store/")))),
    getRestoredCatalog("/store/").map(({ crocin, picrocrocin, safranal, ...publicProduct }) => publicProduct),
  );
  assert.ok(
    getRestoredCatalog("/store/").every((p) =>
      p.image_url.startsWith("/store/products/"),
    ),
  );
});

test("restored server pricing ignores browser prices and rejects removed products", async () => {
  const saved: any[] = [];
  const app = express();
  app.use(express.json());
  app.post(
    "/orders",
    createOrderHandler(
      async (order) => {
        saved.push(order);
        return { ...order, id: 1, createdAt: new Date() };
      },
      loadOrderCatalog,
      async () => null,
    ),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const submit = (id: string) =>
    fetch(`http://127.0.0.1:${address.port}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: randomUUID(),
        customerName: "Isolated restoration",
        phone: "09123456789",
        address: "Synthetic test address",
        total: 1,
        items: [{ productId: id, quantity: 2, price: 1 }],
      }),
    });
  try {
    const response = await submit("local-super-negin-1g");
    assert.equal(response.status, 201);
    assert.equal((await response.json()).total, 898000);
    assert.equal(saved[0].items[0].unitPrice, 449000);
    for (const id of [
      "local-sargol-1g",
      "local-reshteh-2g",
      "local-gift-set-luxe",
      "local-gift-set-signature",
    ])
      assert.equal((await submit(id)).status, 400);
    assert.equal(saved.length, 1);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
});

test("database restoration keeps a backup, removes old-only rows, is repeatable and rejects unreviewed rows", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "CREATE TABLE products (id uuid PRIMARY KEY,slug text UNIQUE,name text,category text,short_description text,long_description text,crocin numeric,picrocrocin numeric,safranal numeric,weight numeric,weight_unit text,price integer,image_url text,is_featured boolean,sort_order integer)",
    );
    const old = JSON.parse(
      await readFile(
        new URL("./catalog-before-twelve-restore.json", import.meta.url),
        "utf8",
      ),
    );
    for (const p of old)
      await db.query(
        "INSERT INTO products (id,slug,name,price) VALUES ($1,$2,$3,$4)",
        [p.id, p.slug, p.name, p.price],
      );
    const script = await readFile(
      new URL("../../../docs/restore-twelve-products.sql", import.meta.url),
      "utf8",
    );
    await db.exec(script);
    const rows = (
      await db.query<{ slug: string; price: number }>(
        "SELECT slug,price FROM products ORDER BY slug",
      )
    ).rows;
    assert.equal(rows.length, 12);
    for (const p of getRestoredCatalog())
      assert.equal(rows.find((r) => r.slug === p.slug)?.price, p.price);
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM varsa_products_before_restore_20261021",
        )
      ).rows[0].n,
      8,
    );
    await db.exec(script);
    assert.deepEqual(
      (await db.query("SELECT slug,price FROM products ORDER BY slug")).rows,
      rows,
    );
    await db.query("INSERT INTO products (id,slug) VALUES ($1,$2)", [
      randomUUID(),
      "unreviewed-product",
    ]);
    await assert.rejects(db.exec(script), /unreviewed rows/);
    await db.exec("ROLLBACK");
    assert.equal(
      (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM products"))
        .rows[0].n,
      13,
    );
  } finally {
    await db.close();
  }
});
