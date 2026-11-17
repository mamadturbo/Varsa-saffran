import { mountSecurity, secureFetch, loginAdmin } from "./security-fixture";
import { outbox } from '@workspace/db/schema';
import { MAX_ATTEMPTS } from '../src/modules/notifications/queue';
import { migrateTest, seedTest, localS3 } from './commerce-fixture';
import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import {
  customerOtpsTable,
  customerSessionsTable,
  customerNotificationsTable,
  customersTable,
} from "@workspace/db/schema";
import { createManagementStore } from "../src/lib/management-store";
import { createManagementRouter } from "../src/lib/management-router";
import { createOrdersRouter } from "../src/lib/orders-router";
import {
  createCustomerServices,
  createCustomerRouter,
} from "../src/lib/customer-router";

let closeS3: (()=>Promise<void>) | undefined;
const pg = new PGlite();
const db = drizzle(pg) as unknown as Parameters<
  typeof createManagementStore
>[0];
const store = createManagementStore(db);
const codes = new Map<string, string>();
const sms: Array<{ phone: string; message: string; eventId?: string }> = [];
let failSms = false;
const sender = async (
  phone: string,
  message: string,
  code?: string,
  eventId?: string,
) => {
  if (code) codes.set(phone, code);
  else {
    if (failSms) throw new Error("isolated-sms-failure");
    sms.push({ phone, message, eventId });
  }
};
const services = createCustomerServices(db, store, sender);
const app = express();
app.use(express.json({ limit: "6mb" }));
mountSecurity(app, db);
app.use("/api", createCustomerRouter(db, store, services));
app.use(
  "/api",
  createManagementRouter(
    db,
    store,
    services.onOrderChange,
    services.afterChange,
  ),
);
app.use(
  "/api",
  createOrdersRouter(
    db,
    async () => (await store.read()).products.filter((p) => p.active),
    store,
    services.identity,
  ),
);
let server: ReturnType<typeof app.listen>, base: string, adminToken: string;
const envNames = [
  "VARSA_ADMIN_PASSWORD",
  "SESSION_SECRET",
  "NODE_ENV",
  "CUSTOMER_AUTH_DEV_OTP",
  "CUSTOMER_SMS_URL",
  "CUSTOMER_SMS_TOKEN",
];
const original = Object.fromEntries(envNames.map((k) => [k, process.env[k]]));
before(async () => {
  process.env.VARSA_ADMIN_PASSWORD = "customer-test-admin";
  process.env.SESSION_SECRET = "customer-test-secret";
  process.env.NODE_ENV = "test";
  process.env.CUSTOMER_AUTH_DEV_OTP = "false";
  process.env.CUSTOMER_SMS_URL = "https://sms.example.test";
  process.env.CUSTOMER_SMS_TOKEN = "isolated-token";
  await migrateTest(pg);
  closeS3 = await localS3();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const a = server.address();
  assert(a && typeof a !== "string");
  base = `http://127.0.0.1:${a.port}/api`;
  adminToken = await loginAdmin(base, db);
});
beforeEach(async () => {
  await pg.exec('TRUNCATE commerce_products CASCADE; TRUNCATE coupons CASCADE; TRUNCATE store_config; TRUNCATE content_entries; TRUNCATE outbox; TRUNCATE stored_files');
  await pg.exec(
    "TRUNCATE orders RESTART IDENTITY CASCADE; TRUNCATE customers CASCADE; TRUNCATE customer_otps; TRUNCATE customer_rate_limits; TRUNCATE store_management",
  );
  codes.clear();
  sms.length = 0;
  failSms = false;
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
  for (const k of envNames) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});
async function req(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  admin = false,
  headers: Record<string, string> = {},
) {
  const r = await secureFetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(admin ? { Cookie: [cookie,adminToken].filter(Boolean).join("; ") } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const content = r.headers.get("content-type") ?? "";
  return {
    status: r.status,
    body: content.includes("json") ? await r.json() : await r.text(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
    headers: r.headers,
  };
}
async function login(phone = "09123456789") {
  const send = await req("/customer/auth/request", "POST", { phone });
  assert.equal(send.status, 200);
  assert.equal(send.body.developmentCode, undefined);
  const verified = await req("/customer/auth/verify", "POST", {
    phone,
    code: codes.get(phone),
  });
  assert.equal(verified.status, 200);
  assert(verified.cookie);
  return { cookie: verified.cookie, customer: verified.body.customer };
}
async function intent(phone = "09123456789") {
  return {
    idempotencyKey: randomUUID(),
    customerName: "مشتری تست",
    phone,
    address: "تهران، نشانی آزمایشی",
    items: [{ productId: (await store.read()).products[0].id, quantity: 1 }],
  };
}
async function createOwned(phone = "09123456789") {
  const owner = await login(phone);
  const order = await req("/orders", "POST", await intent(phone), owner.cookie);
  assert.equal(order.status, 201);
  return { ...owner, order: order.body };
}
async function status(id: string, value: string) {
  const r = await req(
    `/admin/orders/${id}/status`,
    "PATCH",
    { status: value, trackingCode: "TRACK-123" },
    undefined,
    true,
  );
  assert.equal(r.status, 200);
}

test('simultaneous OTP verification consumes one challenge once; resends cannot race past cooldown',async()=>{
 const phone='09128880001';
 const sends=await Promise.all(Array.from({length:5},()=>req('/customer/auth/request','POST',{phone})));
 assert.equal(sends.filter(s=>s.status===200).length,1);assert.equal(sends.filter(s=>s.status===429).length,4);
 const code=codes.get(phone);
 const verified=await Promise.all([req('/customer/auth/verify','POST',{phone,code}),req('/customer/auth/verify','POST',{phone,code})]);
 assert.deepEqual(verified.map(v=>v.status).sort(),[200,400]);
});

test('rotating OTP target numbers and forged forwarded headers cannot evade the shared network budget',async()=>{
 for(let i=0;i<150;i++){
  const response=await req('/customer/auth/verify','POST',{phone:'0912'+String(i).padStart(7,'0'),code:'111111'},undefined,false,{'X-Forwarded-For':`198.51.100.${i+1}`});
  assert.equal(response.status,400);
 }
 assert.equal((await req('/customer/auth/verify','POST',{phone:'09128889999',code:'111111'},undefined,false,{'X-Forwarded-For':'192.0.2.222'})).status,429);
 const rows=await pg.query<{n:number}>('SELECT count(*)::int AS n FROM customer_rate_limits');assert.equal(rows.rows[0].n,152);
});

test('phone change requires both numbers, preserves ownership and revokes old sessions',async()=>{
 const a=await createOwned('09128880002');
 await pg.exec('TRUNCATE customer_rate_limits');
 const phone='09128880003';
 await req('/customer/auth/request','POST',{phone:a.customer.phone});await req('/customer/auth/request','POST',{phone});
 const oldCode=codes.get(a.customer.phone),newCode=codes.get(phone);
 const wrong=oldCode==='111111'?'222222':'111111';
 assert.equal((await req('/customer/auth/change-phone','POST',{phone,oldCode:wrong,newCode},a.cookie)).status,400);
 assert.equal((await req('/customer/auth/change-phone','POST',{phone,oldCode,newCode},a.cookie)).status,200);
 assert.equal((await req('/customer/me','GET',undefined,a.cookie)).body.customer,null);
 assert.equal((await req('/customer/auth/verify','POST',{phone,code:newCode})).status,400);
 await pg.exec('TRUNCATE customer_rate_limits');
 const updated=await login(phone);assert.equal(updated.customer.id,a.customer.id);
 assert.equal((await req('/customer/dashboard','GET',undefined,updated.cookie)).body.orders[0].id,String(a.order.id));
});

test('phone change never merges another customer account even with two valid SMS codes',async()=>{
 const a=await login('09128880004'),b=await login('09128880005');
 await pg.exec('TRUNCATE customer_rate_limits');
 await req('/customer/auth/request','POST',{phone:a.customer.phone});await req('/customer/auth/request','POST',{phone:b.customer.phone});
 assert.equal((await req('/customer/auth/change-phone','POST',{phone:b.customer.phone,oldCode:codes.get(a.customer.phone),newCode:codes.get(b.customer.phone)},a.cookie)).status,409);
 assert.equal((await req('/customer/me','GET',undefined,a.cookie)).body.customer.id,a.customer.id);
});
const png = {
  mime: "image/png",
  data: "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVQImWP4v5vh/24GEP6/mwEANGIG6cZZZQ8AAAAASUVORK5CYII=",
};

test("OTP is single use, cookie is HttpOnly, and sessions store only token hashes", async () => {
  const owner = await login();
  const used = await req("/customer/auth/verify", "POST", {
    phone: owner.customer.phone,
    code: codes.get(owner.customer.phone),
  });
  assert.equal(used.status, 400);
  assert.equal(
    (await req("/customer/me", "GET", undefined, owner.cookie)).body.customer
      .id,
    owner.customer.id,
  );
  const rows = await db.select().from(customerSessionsTable);
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].tokenHash, owner.cookie.split("=")[1]);
  const other = await req("/customer/auth/request", "POST", {
    phone: "09123456788",
  });
  assert.equal(other.status, 200);
  const verified = await req("/customer/auth/verify", "POST", {
    phone: "09123456788",
    code: codes.get("09123456788"),
  });
  assert.match(verified.headers.get("set-cookie")!, /HttpOnly/);
  assert.match(verified.headers.get("set-cookie")!, /SameSite=Lax/);
  await req("/customer/auth/logout", "POST", {}, owner.cookie);
  assert.equal(
    (await req("/customer/me", "GET", undefined, owner.cookie)).body.customer,
    null,
  );
});
test("wrong attempts, expiry, resend throttling and expired sessions are enforced", async () => {
  const phone = "09123456789";
  assert.equal(
    (await req("/customer/auth/request", "POST", { phone })).status,
    200,
  );
  assert.equal(
    (await req("/customer/auth/request", "POST", { phone })).status,
    429,
  );
  const wrong = codes.get(phone) === "111111" ? "222222" : "111111";
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await req("/customer/auth/verify", "POST", { phone, code: wrong }))
        .status,
      400,
    );
  assert.equal(
    (
      await req("/customer/auth/verify", "POST", {
        phone,
        code: codes.get(phone),
      })
    ).status,
    400,
  );
  const second = "09123456788";
  await req("/customer/auth/request", "POST", { phone: second });
  await db
    .update(customerOtpsTable)
    .set({ expiresAt: new Date(0) })
    .where(eq(customerOtpsTable.phone, second));
  assert.equal(
    (
      await req("/customer/auth/verify", "POST", {
        phone: second,
        code: codes.get(second),
      })
    ).status,
    400,
  );
  const owner = await login("09123456787");
  await db
    .update(customerSessionsTable)
    .set({ expiresAt: new Date(0) })
    .where(eq(customerSessionsTable.customerId, owner.customer.id));
  assert.equal(
    (await req("/customer/dashboard", "GET", undefined, owner.cookie)).status,
    401,
  );
});
test("production never returns development OTP, even if the flag is set", async () => {
  process.env.NODE_ENV = "production";
  process.env.CUSTOMER_AUTH_DEV_OTP = "true";
  try {
    const r = await req("/customer/auth/request", "POST", {
      phone: "09123456789",
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.developmentCode, undefined);
    assert(codes.get("09123456789"));
  } finally {
    process.env.NODE_ENV = "test";
    process.env.CUSTOMER_AUTH_DEV_OTP = "false";
  }
});
test("customer and admin authentication are separate; foreign origins cannot mutate accounts", async () => {
  const owner = await login();
  assert.equal(
    (await req("/customer/dashboard", "GET", undefined, undefined, true))
      .status,
    401,
  );
  assert.equal(
    (await req("/admin/customer-service", "GET", undefined, owner.cookie))
      .status,
    401,
  );
  assert.equal(
    (
      await req(
        "/customer/profile",
        "PUT",
        { name: "تست", email: "", smsUpdates: false },
        owner.cookie,
        false,
        { Origin: "https://evil.example" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await req(
        "/customer/auth/request",
        "POST",
        { phone: "09123456788" },
        undefined,
        false,
        { Origin: "https://evil.example" },
      )
    ).status,
    403,
  );
});
test("new orders attach to verified account exactly once; other customers cannot see or claim them", async () => {
  const a = await login(),
    b = await login("09123456788");
  const input = await intent();
  const order = await req("/orders", "POST", input, a.cookie);
  assert.equal(order.status, 201);
  assert.equal((await req("/orders", "POST", input, a.cookie)).status, 201);
  const own = (await req("/customer/dashboard", "GET", undefined, a.cookie))
    .body;
  assert.equal(own.orders.length, 1);
  assert.equal(own.orders[0].idempotencyKey, undefined);
  assert.equal(own.orders[0].requestFingerprint, undefined);
  assert.equal(own.orders[0].paymentStatus, "unpaid");
  assert.equal(
    (await req("/customer/dashboard", "GET", undefined, b.cookie)).body.orders
      .length,
    0,
  );
  assert.equal(
    (
      await req(
        "/customer/claim-order",
        "POST",
        { orderNumber: order.body.orderNumber },
        b.cookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (await req("/orders", "POST", await intent(a.customer.phone), b.cookie))
      .status,
    400,
  );
});
test("guest order needs matching verified number and exact order code before appearing", async () => {
  const order = await req("/orders", "POST", await intent());
  const owner = await login();
  assert.equal(
    (await req("/customer/dashboard", "GET", undefined, owner.cookie)).body
      .orders.length,
    0,
  );
  assert.equal(
    (
      await req(
        "/customer/claim-order",
        "POST",
        { orderNumber: "VRS-NOT-REAL" },
        owner.cookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await req(
        "/customer/claim-order",
        "POST",
        { orderNumber: order.body.orderNumber },
        owner.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await req("/customer/dashboard", "GET", undefined, owner.cookie)).body
      .orders.length,
    1,
  );
});
test("profile, addresses/defaults and wishlist are persisted without accepting a forged phone", async () => {
  const a = await login(),
    b = await login("09123456788");
  const changed = await req(
    "/customer/profile",
    "PUT",
    {
      phone: b.customer.phone,
      name: "مشتری ورسا",
      email: "test@example.com",
      smsUpdates: true,
    },
    a.cookie,
  );
  assert.equal(changed.status, 200);
  assert.equal(changed.body.customer.phone, a.customer.phone);
  const address = {
    id: randomUUID(),
    label: "خانه",
    recipient: "گیرنده",
    phone: a.customer.phone,
    province: "تهران",
    city: "تهران",
    address: "نشانی تست",
    postalCode: "1234567890",
    isDefault: true,
  };
  assert.equal(
    (await req(`/customer/addresses/${address.id}`, "PUT", address, a.cookie))
      .status,
    200,
  );
  const second = {
    ...address,
    id: randomUUID(),
    label: "کار",
    isDefault: true,
  };
  const saved = await req(
    `/customer/addresses/${second.id}`,
    "PUT",
    second,
    a.cookie,
  );
  assert.equal(
    saved.body.customer.profile.addresses.filter(
      (a: { isDefault: boolean }) => a.isDefault,
    ).length,
    1,
  );
  const foreign = await req(
    `/customer/addresses/${address.id}`,
    "DELETE",
    {},
    b.cookie,
  );
  assert.equal(foreign.body.customer.profile.addresses.length, 0);
  assert.equal(
    (await req("/customer/me", "GET", undefined, a.cookie)).body.customer
      .profile.addresses.length,
    2,
  );
  const pid = (await store.read()).products[0].id;
  await req(
    "/customer/favorites",
    "PUT",
    { ids: [pid, pid, "unknown"] },
    a.cookie,
  );
  assert.deepEqual(
    (await req("/customer/me", "GET", undefined, a.cookie)).body.customer
      .profile.favorites,
    [pid],
  );
});
test("support messages, customer isolation, private attachments and admin replies work together", async () => {
  const a = await createOwned(),
    b = await login("09123456788");
  const media = await req("/customer/media", "POST", png, a.cookie);
  assert.equal(media.status, 201);
  const url = media.body.url;
  assert.equal(
    (await req(url.replace("/api", ""), "GET", undefined, b.cookie)).status,
    404,
  );
  assert.equal(
    (await req(url.replace("/api", ""), "GET", undefined, a.cookie)).status,
    200,
  );
  assert.equal(
    (await req(url.replace("/api", ""), "GET", undefined, undefined, true))
      .status,
    200,
  );
  assert.equal(
    (
      await req(
        "/customer/cases",
        "POST",
        { kind: "ticket", subject: "تقلب", message: "تست", images: [url] },
        b.cookie,
      )
    ).status,
    400,
  );
  const created = await req(
    "/customer/cases",
    "POST",
    {
      kind: "ticket",
      orderId: Number(a.order.id),
      subject: "پرسش درباره سفارش",
      message: "پیام مشتری",
      images: [url],
    },
    a.cookie,
  );
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.equal(
    (
      await req(
        `/customer/cases/${id}/reply`,
        "POST",
        { message: "بیگانه" },
        b.cookie,
      )
    ).status,
    404,
  );
  const response = await req(
    `/admin/customer-service/cases/${id}`,
    "POST",
    { status: "waiting_customer", message: "پاسخ ورسا" },
    undefined,
    true,
  );
  assert.equal(response.status, 200);
  const panel = (await req("/customer/dashboard", "GET", undefined, a.cookie))
    .body;
  assert.equal(panel.cases[0].payload.messages.length, 2);
  assert.equal(panel.notifications[0].title, "پاسخ فروشگاه دریافت شد");
  assert.equal(
    (
      await req(
        `/customer/cases/${id}/reply`,
        "POST",
        { message: "سپاس" },
        a.cookie,
      )
    ).status,
    200,
  );
  await req("/customer/notifications/read", "POST", {}, a.cookie);
  assert(
    (await req("/customer/dashboard", "GET", undefined, a.cookie)).body
      .notifications[0].readAt,
  );
});
test("cancellation approval restores inventory once; duplicate or post-shipping requests fail", async () => {
  const owner = await login();
  await store.mutate(async (s) => {
    s.products[0].stock = 2;
  });
  const order = await req("/orders", "POST", await intent(), owner.cookie);
  const b = {
    kind: "cancel",
    orderId: Number(order.body.id),
    subject: "درخواست لغو",
    message: "تغییر برنامه",
  };
  const request = await req("/customer/cases", "POST", b, owner.cookie);
  assert.equal(request.status, 201);
  assert.equal(
    (await req("/customer/cases", "POST", b, owner.cookie)).status,
    409,
  );
  assert.equal(
    (
      await req(
        `/admin/customer-service/cases/${request.body.id}`,
        "POST",
        { status: "approved", message: "لغو تأیید شد" },
        undefined,
        true,
      )
    ).status,
    200,
  );
  assert.equal((await store.read()).products[0].stock, 2);
  assert.equal(
    (
      await req(
        `/admin/customer-service/cases/${request.body.id}`,
        "POST",
        { status: "approved", message: "تکرار" },
        undefined,
        true,
      )
    ).status,
    409,
  );
  assert.equal((await store.read()).products[0].stock, 2);
  const another = await req("/orders", "POST", await intent(), owner.cookie);
  await status(another.body.id, "shipped");
  assert.equal(
    (
      await req(
        "/customer/cases",
        "POST",
        { ...b, orderId: Number(another.body.id) },
        owner.cookie,
      )
    ).status,
    400,
  );
});
test("returns require delivery and deadline; approval never pretends to refund or restock", async () => {
  const a = await createOwned();
  const body = {
    kind: "return",
    orderId: Number(a.order.id),
    subject: "مرجوعی",
    message: "بسته نیاز به بررسی دارد",
  };
  assert.equal(
    (await req("/customer/cases", "POST", body, a.cookie)).status,
    400,
  );
  await status(a.order.id, "delivered");
  const made = await req("/customer/cases", "POST", body, a.cookie);
  assert.equal(made.status, 201);
  const stock = (await store.read()).products[0].stock;
  assert.equal(
    (
      await req(
        `/admin/customer-service/cases/${made.body.id}`,
        "POST",
        { status: "approved", message: "برای هماهنگی بازگشت تماس بگیرید" },
        undefined,
        true,
      )
    ).status,
    200,
  );
  assert.equal((await store.read()).products[0].stock, stock);
  await store.mutate(async (s) => {
    s.orderMeta[a.order.id].deliveredAt = new Date(
      Date.now() - 8 * 86400000,
    ).toISOString();
  });
  assert.equal(
    (await req("/customer/cases", "POST", body, a.cookie)).status,
    400,
  );
});
test("reviews require an owned delivered product, remain private until approval, and edits reset approval", async () => {
  const a = await createOwned(),
    b = await login("09123456788"),
    pid = (await store.read()).products[0].id;
  const review = { rating: 5, body: "عطر و بسته‌بندی خوب" };
  assert.equal(
    (await req(`/customer/reviews/${pid}`, "PUT", review, a.cookie)).status,
    403,
  );
  await status(a.order.id, "delivered");
  assert.equal(
    (await req(`/customer/reviews/${pid}`, "PUT", review, b.cookie)).status,
    403,
  );
  assert.equal(
    (await req(`/customer/reviews/${pid}`, "PUT", review, a.cookie)).status,
    200,
  );
  assert.equal((await req(`/store/reviews/${pid}`)).body.count, 0);
  const row = (await req("/customer/dashboard", "GET", undefined, a.cookie))
    .body.reviews[0];
  await req(
    `/admin/customer-service/reviews/${row.id}`,
    "PATCH",
    { published: true },
    undefined,
    true,
  );
  const publicData = (await req(`/store/reviews/${pid}`)).body;
  assert.equal(publicData.average, 5);
  assert.equal(publicData.reviews[0].customerId, undefined);
  await req(
    `/customer/reviews/${pid}`,
    "PUT",
    { rating: 4, body: "نظر ویرایش‌شده" },
    a.cookie,
  );
  assert.equal((await req(`/store/reviews/${pid}`)).body.count, 0);
  assert.equal(
    (await req("/customer/dashboard", "GET", undefined, a.cookie)).body.reviews
      .length,
    1,
  );
});
test("SMS notifications require both store setting and customer consent, with durable failures for retry", async () => {
  const a = await createOwned();
  await store.mutate(async (s) => {
    s.settings.transactionalSmsEnabled = true;
  });
  await status(a.order.id, "confirmed");
  assert.equal(sms.length, 0);
  await req(
    "/customer/profile",
    "PUT",
    { name: "تست", email: "", smsUpdates: true },
    a.cookie,
  );
  await status(a.order.id, "processing");
  await services.flushSms();
  for (let i = 0; i < 10 && !sms.length; i++)
    await new Promise((r) => setTimeout(r, 20));
  assert.equal(sms.length, 1);
  assert(sms[0].eventId);
  assert(!sms[0].message.includes("نشانی"));
  failSms = true;
  await status(a.order.id, "shipped");
  for(let attempt=0;attempt<MAX_ATTEMPTS;attempt++) {
    await db.update(outbox).set({availableAt:new Date(Date.now()-1000)}).where(eq(outbox.status,'pending'));
    await services.flushSms();
  }
  for (let i = 0; i < 15; i++) {
    const rows = await db
      .select()
      .from(customerNotificationsTable)
      .where(eq(customerNotificationsTable.smsStatus, "failed"));
    if (rows.length) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(
    (
      await db
        .select()
        .from(customerNotificationsTable)
        .where(eq(customerNotificationsTable.smsStatus, "failed"))
    ).length,
    1,
  );
  failSms = false;
  await req("/admin/customer-service/retry-sms", "POST", {}, undefined, true);
  await services.flushSms();
  for (let i = 0; i < 15 && sms.length < 2; i++)
    await new Promise((r) => setTimeout(r, 20));
  assert.equal(sms.length, 2);
});


