import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import express from "express";
import sharp from "sharp";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
import {
  ordersTable,
  orderDetails,
  cardTransferReceipts,
  outbox,
  reservations,
  inventory,
} from "@workspace/db/schema";
import { migrateTest, seedTest } from "./commerce-fixture";
import { mountSecurity, secureFetch } from "./security-fixture";
import { createManagementStore, StoreError } from "../src/lib/management-store";
import { paymentRoutes } from "../src/modules/payments/router";
import { createCustomerServices } from "../src/modules/customers/router";
import { cardTransferConfig } from "../src/modules/payments/config";
import { submitReceipt, reviewReceipt } from "../src/modules/payments/service";
import {
  handleBaleUpdate,
  pollBale,
  sendReceiptToBale,
  type BaleCall,
} from "../src/modules/payments/bale";
import { expireOne } from "../src/modules/inventory/expiry";
import {
  claimJob,
  finishJob,
  MAX_ATTEMPTS,
} from "../src/modules/notifications/queue";

const pg = new PGlite();
const db = drizzle(pg) as unknown as Parameters<
  typeof createManagementStore
>[0];
const store = createManagementStore(db);
const services = createCustomerServices(db, store);
const app = express();
mountSecurity(app, db);
const payments = paymentRoutes(db, services);
app.use("/api", payments.beforeBody);
app.use(express.json({ limit: "6mb" }));
app.use("/api", payments.router);
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res
      .status(error instanceof StoreError ? error.status : 503)
      .json({
        message: error instanceof StoreError ? error.message : "failure",
      });
  },
);
let base: string,
  server: ReturnType<typeof app.listen>,
  root: string,
  png: string;
let order: Awaited<ReturnType<typeof store.save>>, key: string;
before(async () => {
  process.env.SESSION_SECRET = "isolated-card-transfer-secret";
  process.env.CUSTOMER_AUTH_SECRET = "isolated-card-transfer-customer-secret";
  Object.assign(process.env, {
    CARD_TRANSFER_ENABLED: "true",
    CARD_TRANSFER_NUMBER: "6037990000000000",
    CARD_TRANSFER_ACCOUNT_NAME: "حساب آزمایشی",
    CARD_TRANSFER_BANK_NAME: "بانک آزمایشی",
    BALE_BOT_TOKEN: "isolated-unused-token",
    BALE_ADMIN_CHAT_ID: "123",
    BALE_ADMIN_USER_IDS: "123",
    STORAGE_DRIVER: "local",
  });
  root = await mkdtemp(join(tmpdir(), "varsa-card-transfer-"));
  process.env.STORAGE_LOCAL_ROOT = root;
  png = (
    await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#bd7521" },
    })
      .png()
      .toBuffer()
  ).toString("base64");
  await migrateTest(pg);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}/api`;
});
beforeEach(async () => {
  await pg.exec(
    "TRUNCATE orders RESTART IDENTITY CASCADE; TRUNCATE commerce_products CASCADE; TRUNCATE coupons CASCADE; TRUNCATE store_config; TRUNCATE content_entries; TRUNCATE outbox; TRUNCATE security_limits; UPDATE bale_bot_state SET next_offset=0",
  );
  await seedTest(db);
  const state = await store.publicState(),
    product = state.products.find((p) => p.active)!;
  // Configure an explicit final shipping amount for payment.
  await db.execute(
    sql`UPDATE store_config SET settings=jsonb_set(settings,'{shippingEnabled}','true'::jsonb)`,
  );
  key = randomUUID();
  const { priceOrder } = await import("../src/lib/management-store");
  const pricing = priceOrder(
    await store.publicState(),
    [{ productId: product.id, quantity: 1 }],
    "",
  );
  order = await store.save({
    orderNumber: "VRS-ISOLATED-" + randomUUID().slice(0, 8),
    idempotencyKey: key,
    requestFingerprint: "isolated",
    customerName: "مشتری آزمایشی",
    phone: "09120000000",
    address: "نشانی آزمایشی",
    items: [
      {
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        quantity: 1,
        imageUrl: "",
      },
    ],
    total: pricing.total,
    status: "pending",
  });
});
after(async () => {
  if (server)
    await new Promise<void>((r) => {
      server.close(() => r());
      server.closeAllConnections();
    });
  await pg.close();
  assert.equal(dirname(resolve(root)), resolve(tmpdir()));
  assert.match(basename(root), /^varsa-card-transfer-/);
  await rm(root, { recursive: true, force: true });
});
async function request(
  path = "",
  method = "GET",
  body?: unknown,
  suppliedKey: string | null = key,
) {
  return secureFetch(`${base}/orders/${order.id}/payment${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(suppliedKey ? { "X-Order-Key": suppliedKey } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function callback(
  id: string,
  action = "a",
  user = 123,
  chat = 123,
  update = 1,
) {
  return {
    update_id: update,
    callback_query: {
      id: "callback-" + update,
      from: { id: user },
      data: `pay:${action}:${id}`,
      message: { message_id: 9, chat: { id: chat } },
    },
  };
}
const review = (id: string, action: "approved" | "rejected") =>
  db.transaction((tx) =>
    reviewReceipt(tx as unknown as typeof db, id, action, "bale:123"),
  );

test("unconfigured payments reveal no destination and accept no receipt", async () => {
  process.env.CARD_TRANSFER_ENABLED = "false";
  try {
    assert.deepEqual(cardTransferConfig(), { enabled: false });
    assert.equal(
      (await request("/receipt", "POST", { data: png, mime: "image/png" }))
        .status,
      409,
    );
  } finally {
    process.env.CARD_TRANSFER_ENABLED = "true";
  }
});
test("guest capability is required before a large body; response never exposes storage or checkout keys", async () => {
  assert.equal((await request("", "GET", undefined, null)).status, 403);
  assert.equal((await request("", "GET", undefined, randomUUID())).status, 403);
  assert.equal(
    (
      await request(
        "/receipt",
        "POST",
        { data: "x".repeat(200000) },
        randomUUID(),
      )
    ).status,
    403,
  );
  const response = await request();
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.ok(!text.includes(key));
  assert.ok(!text.includes("objectKey"));
  const noCsrf = await fetch(`${base}/orders/${order.id}/payment/receipt`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Order-Key": key },
    body: JSON.stringify({ data: png, mime: "image/png" }),
  });
  assert.equal(noCsrf.status, 403);
});
test("upload is private, amount comes from server and retries do not duplicate a pending receipt", async () => {
  const r = await request("/receipt", "POST", {
    data: png,
    mime: "image/png",
    amount: 1,
  });
  assert.equal(r.status, 201);
  const first = (await r.json()).receipt;
  assert.equal(
    (await request("/receipt", "POST", { data: png, mime: "image/png" }))
      .status,
    201,
  );
  const rows = await db.select().from(cardTransferReceipts);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, first.id);
  assert.equal(rows[0].amount, order.total);
  assert.ok(rows[0].objectKey.startsWith("private/"));
  assert.equal(
    (await db.select().from(orderDetails))[0].paymentStatus,
    "unpaid",
  );
  assert.equal(
    (await db.select().from(outbox).where(eq(outbox.kind, "bale.receipt")))
      .length,
    1,
  );
  assert.equal((await (await request()).json()).receipt.status, "pending");
});
test("malformed images and unknown shipping amount cannot enter the review queue", async () => {
  assert.equal(
    (
      await request("/receipt", "POST", {
        data: "not-an-image",
        mime: "image/png",
      })
    ).status,
    400,
  );
  await db.execute(
    sql`UPDATE order_details SET meta=jsonb_set(meta,'{shippingConfigured}','false'::jsonb)`,
  );
  assert.equal(
    (await request("/receipt", "POST", { data: png, mime: "image/png" }))
      .status,
    409,
  );
  assert.equal((await db.select().from(cardTransferReceipts)).length, 0);
});
test("Bale gets a real multipart photo and approval buttons without a public receipt URL", async () => {
  const receipt = await submitReceipt(db, order.id, png, "image/png");
  const call: BaleCall = async <T>(
    method: string,
    data: Record<string, unknown> | FormData,
  ) => {
    assert.equal(method, "sendPhoto");
    assert.ok(data instanceof FormData);
    assert.ok(data.get("photo") instanceof Blob);
    assert.match(String(data.get("caption")), /تومان/);
    assert.match(String(data.get("reply_markup")), new RegExp(receipt.id));
    assert.ok(!String(data.get("caption")).includes(receipt.objectKey));
    return { message_id: 9 } as T;
  };
  await sendReceiptToBale(db, receipt.id, call);
});
test("only allowed Bale user and private chat can approve; repeated or opposite clicks keep the first decision", async () => {
  const receipt = await submitReceipt(db, order.id, png, "image/png");
  await handleBaleUpdate(db, callback(receipt.id, "a", 999));
  await handleBaleUpdate(db, callback(receipt.id, "a", 123, 999));
  assert.equal(
    (await db.select().from(orderDetails))[0].paymentStatus,
    "unpaid",
  );
  const result = await db.transaction((tx) =>
    handleBaleUpdate(tx as unknown as typeof db, callback(receipt.id)),
  );
  assert.match(result!.text, /تأیید/);
  await review(receipt.id, "approved");
  await review(receipt.id, "rejected");
  assert.equal((await db.select().from(ordersTable))[0].status, "confirmed");
  assert.equal((await db.select().from(orderDetails))[0].paymentStatus, "paid");
  assert.equal(
    (await db.select().from(cardTransferReceipts))[0].status,
    "approved",
  );
  assert.equal(
    (await db.select().from(outbox).where(eq(outbox.kind, "payment.reviewed")))
      .length,
    1,
  );
});
test("awaiting review does not expire stock; rejection permits a corrected receipt and old buttons cannot approve it", async () => {
  const [product] = await db.select().from(inventory);
  await db
    .update(inventory)
    .set({ available: 5 })
    .where(eq(inventory.variantId, product.variantId));
  await db
    .insert(reservations)
    .values({
      orderId: order.id,
      variantId: product.variantId,
      quantity: 1,
      expiresAt: new Date(Date.now() - 1000),
    });
  const first = await submitReceipt(db, order.id, png, "image/png");
  assert.equal(await expireOne(db), false);
  await review(first.id, "rejected");
  assert.equal(await expireOne(db), false);
  const second = await submitReceipt(db, order.id, png, "image/png");
  assert.notEqual(first.id, second.id);
  assert.equal(await review(first.id, "approved"), "rejected");
  assert.equal(
    (await db.select().from(orderDetails))[0].paymentStatus,
    "unpaid",
  );
  await review(second.id, "approved");
});
test("cancelled order cannot be approved and receipt cannot be reused for another order", async () => {
  const receipt = await submitReceipt(db, order.id, png, "image/png");
  const [other] = await db
    .insert(ordersTable)
    .values({
      orderNumber: "VRS-OTHER",
      customerName: "other",
      phone: "09120000000",
      address: "test",
      items: [],
      total: order.total,
      status: "pending",
      idempotencyKey: randomUUID(),
      requestFingerprint: "other",
    })
    .returning();
  await db
    .insert(orderDetails)
    .values({
      orderId: other.id,
      meta: { shippingConfigured: true },
      addressSnapshot: {},
    });
  await assert.rejects(
    submitReceipt(db, other.id, png, "image/png"),
    /سفارش دیگری/,
  );
  await db
    .update(ordersTable)
    .set({ status: "cancelled" })
    .where(eq(ordersTable.id, order.id));
  await assert.rejects(review(receipt.id, "approved"), /وضعیت سفارش/);
});
test("poll cursor and decision survive failed acknowledgements; transport failure cannot lose the update", async () => {
  const receipt = await submitReceipt(db, order.id, png, "image/png");
  await assert.rejects(
    pollBale(db, async () => {
      throw new Error("offline");
    }),
  );
  assert.equal(
    (
      await db.execute<{ next_offset: number }>(
        sql`SELECT next_offset FROM bale_bot_state`,
      )
    ).rows[0].next_offset,
    0,
  );
  const call: BaleCall = async <T>(method: string) => {
    if (method === "answerCallbackQuery") throw new Error("offline");
    return [callback(receipt.id, "a", 123, 123, 42)] as T;
  };
  await pollBale(db, call);
  await pollBale(db, call);
  assert.equal(
    (
      await db.execute<{ next_offset: number }>(
        sql`SELECT next_offset FROM bale_bot_state`,
      )
    ).rows[0].next_offset,
    43,
  );
  assert.equal(
    (await db.select().from(outbox).where(eq(outbox.kind, "payment.reviewed")))
      .length,
    1,
  );
});
test("failed delivery remains visible and can be retried without uploading again", async () => {
  const receipt = await submitReceipt(db, order.id, png, "image/png");
  await db
    .update(outbox)
    .set({ status: "failed", attempts: MAX_ATTEMPTS })
    .where(eq(outbox.id, `bale-receipt:${receipt.id}`));
  assert.equal(
    (await (await request()).json()).receipt.deliveryStatus,
    "failed",
  );
  assert.equal((await request("/retry", "POST", {})).status, 200);
  const job = await claimJob(db);
  assert.ok(job);
  await finishJob(db, job);
  assert.equal((await db.select().from(cardTransferReceipts)).length, 1);
});
