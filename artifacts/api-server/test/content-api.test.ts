import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { contactMessages, contentEntries } from "@workspace/db/schema";
import { createManagementStore, StoreError } from "../src/lib/management-store";
import { contentRouter } from "../src/modules/content/router";
import { createManagementRouter } from "../src/lib/management-router";
import { createOrdersRouter } from "../src/lib/orders-router";
import { importLegacyArticles } from "../src/modules/content/service";
import { migrateTest, seedTest } from "./commerce-fixture";
import { setBaseUrl } from "../../../lib/api-client-react/src/custom-fetch";
import {
  fetchArticles,
  fetchArticleBySlug,
  submitContact,
  fetchProducts,
} from "../../varsa-shop/src/lib/api";

const pg = new PGlite(),
  db = drizzle(pg) as unknown as Parameters<typeof createManagementStore>[0],
  store = createManagementStore(db);
let server: ReturnType<ReturnType<typeof express>["listen"]>, base: string;
const oldSecret = process.env.SESSION_SECRET;
before(async () => {
  process.env.SESSION_SECRET = "isolated-content-test";
  await migrateTest(pg);
  await seedTest(db);
  const app = express();
  app.use(express.json());
  app.use("/api", contentRouter(db, store));
  app.use("/api", createManagementRouter(db, store));
  app.use(
    (
      e: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) =>
      res
        .status(e instanceof StoreError ? e.status : 503)
        .json({ message: e instanceof StoreError ? e.message : "failed" }),
  );
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}`;
  setBaseUrl(base);
});
after(async () => {
  setBaseUrl(null);
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await pg.close();
  if (oldSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = oldSecret;
});
beforeEach(async () => {
  await pg.exec(
    "TRUNCATE contact_messages_api; TRUNCATE customer_rate_limits; TRUNCATE content_entries",
  );
  await store.mutate(async (s) => {
    s.legacyArticlesEnabled = false;
    s.articles = [];
  });
});
const article = {
  id: "a",
  slug: "آموزش",
  title: "آموزش زعفران",
  excerpt: "خلاصه",
  content: "متن",
  image_url: "/image.png",
  author: "ورسا",
  category: "آموزش",
  read_time: 2,
  created_at: "2026-01-01T00:00:00.000Z",
  published: true,
};
test("actual frontend API functions read local articles and catalog without Supabase", async () => {
  await store.mutate(async (s) => {
    s.articles = [
      article,
      { ...article, id: "draft", slug: "draft", published: false },
    ];
  });
  assert.deepEqual(await fetchArticles(), [article]);
  assert.equal((await fetchArticleBySlug(article.slug))?.id, "a");
  assert.equal(await fetchArticleBySlug("draft"), null);
  assert.equal((await fetchProducts()).length, 12);
});
test("actual contact form client normalizes phone; API validates and rate-limits durable inserts", async () => {
  await submitContact({
    name: "مشتری",
    phone: "+98 912 345 6789",
    subject: "پرسش",
    message: "تست",
  });
  assert.equal(
    (await db.select().from(contactMessages))[0].phone,
    "09123456789",
  );
  await assert.rejects(() =>
    submitContact({
      name: "مشتری",
      phone: "invalid",
      subject: "پرسش",
      message: "تست",
    }),
  );
  const post = (body: unknown) =>
    fetch(`${base}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal(
    (await post({ name: "", phone: "09123456789", subject: "a", message: "x" }))
      .status,
    400,
  );
  for (let i = 0; i < 4; i++)
    assert.equal(
      (
        await post({
          name: "a",
          phone: "09123456789",
          subject: "a",
          message: "x",
        })
      ).status,
      201,
    );
  assert.equal(
    (
      await post({
        name: "a",
        phone: "09123456789",
        subject: "a",
        message: "x",
      })
    ).status,
    429,
  );
  assert.equal((await db.select().from(contactMessages)).length, 5);
});
test("browser source has no Supabase import or credentials after migration", async () => {
  const source = await readFile(
    new URL("../../varsa-shop/src/lib/api.ts", import.meta.url),
    "utf8",
  );
  assert(!/supabase|VITE_SUPABASE/.test(source));
});
test("server article import preserves overrides and disables the legacy dependency after reconciliation", async () => {
  const upstream = express();
  upstream.get("/rest/v1/articles", (_req, res) => res.json([article]));
  const legacyServer = upstream.listen(0, "127.0.0.1");
  await once(legacyServer, "listening");
  const address = legacyServer.address();
  assert(address && typeof address !== "string");
  const old = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY,
  };
  process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_ANON_KEY = "isolated-public-key";
  try {
    await store.mutate(async (s) => {
      s.legacyArticlesEnabled = true;
      s.articles = [{ ...article, title: "edited title" }];
    });
    assert.equal((await importLegacyArticles(store)).imported, 1);
    legacyServer.closeAllConnections();
    await new Promise<void>((r) => legacyServer.close(() => r()));
    assert.equal((await fetchArticles())[0].title, "edited title");
    assert.equal((await importLegacyArticles(store)).alreadyImported, true);
    await store.mutate(async (s) => {
      s.legacyArticlesEnabled = true;
    });
    assert.equal((await fetchArticles())[0].title, "edited title");
  } finally {
    if (legacyServer.listening) {
      legacyServer.closeAllConnections();
      await new Promise<void>((r) => legacyServer.close(() => r()));
    }
    if (old.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = old.url;
    if (old.key === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = old.key;
  }
});
