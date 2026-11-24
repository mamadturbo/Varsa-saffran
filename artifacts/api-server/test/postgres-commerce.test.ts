import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from 'node:net';
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import {
  createManagementStore,
  initialState,
} from "../src/lib/management-store";
import { backfillCommerce } from "../src/modules/catalog/backfill";
import { updateManagedOrder } from "../src/lib/order-status";
import { expireOne } from "../src/modules/inventory/expiry";
import {
  claimJob,
  finishJob,
  processOne,
  MAX_ATTEMPTS,
} from "../src/modules/notifications/queue";
import {
  fileService,
  imageBytes,
  s3Storage,
} from "../src/modules/files/storage";
import {
  ordersTable,
  orderItems,
  outbox,
  storeManagementTable,
  inventory,
  reservations,
  coupons,
  variants,
} from "@workspace/db/schema";
import type { ManagementState } from "@workspace/catalog";
import { migrateTest, seedTest, localS3, stopIsolatedPostgres } from "./commerce-fixture";
import type { OrderToSave } from "../src/lib/create-order";
import express from 'express';
import { mountSecurity,secureFetch,seedAdmin } from './security-fixture';
import { hasValidAdminToken } from '../src/lib/admin-security';
import { verifyRuntimeRole } from '../src/lib/runtime-role';

let engine: EmbeddedPostgres,
  pool: pg.Pool,
  dir: string,
  closeS3: () => Promise<void>,
  databaseUrl: string;
let db: Parameters<typeof createManagementStore>[0],
  store: ReturnType<typeof createManagementStore>;
before(
  async () => {
    dir = await mkdtemp(path.join(tmpdir(), "varsa-pg-"));
    const portProbe=createServer();portProbe.listen(0,'127.0.0.1');await once(portProbe,'listening');
    const probeAddress=portProbe.address();assert(probeAddress&&typeof probeAddress!=='string');const testPort=probeAddress.port;
    await new Promise<void>(resolve=>portProbe.close(()=>resolve()));
    // A fresh real server, bound only to loopback. No application env is loaded.
    engine = new EmbeddedPostgres({
      databaseDir: path.join(dir, "data"),
      port: testPort,
      user: "varsa_test",
      password: randomUUID(),
      persistent: true,
      initdbFlags: ["--encoding=UTF8"],
      postgresFlags: ["-h", "127.0.0.1"],
      onLog: () => {},
      onError: () => {},
    });
    await engine.initialise();
    await engine.start();
    const client = engine.getPgClient();
    await client.connect();
    const config = (
      client as unknown as { connectionParameters: pg.PoolConfig }
    ).connectionParameters;
    databaseUrl = `postgresql://${encodeURIComponent(String(config.user))}:${encodeURIComponent(String(config.password))}@127.0.0.1:${testPort}/${config.database}`;
    pool = new pg.Pool({
      host: "127.0.0.1",
      port: testPort,
      user: config.user,
      password: config.password,
      database: config.database,
      max: 12,
    });
    await client.end();
    db = drizzle(pool) as unknown as typeof db;
    store = createManagementStore(db);
    await migrateTest({ exec: async (s) => pool.query(s) });
    closeS3 = await localS3();
  },
  { timeout: 120000 },
);
after(async () => {
  await closeS3?.();
  await pool?.end();
  if(engine)await stopIsolatedPostgres(engine);
  if (dir) {
    if (
      path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) ||
      !path.basename(dir).startsWith("varsa-pg-")
    )
      throw new Error("Unsafe cleanup target");
    await rm(dir, { recursive: true, force: true, maxRetries:10, retryDelay:100 });
  }
});
beforeEach(async () => {
  await pool.query(
    "TRUNCATE orders RESTART IDENTITY CASCADE; TRUNCATE commerce_products CASCADE; TRUNCATE coupons CASCADE; TRUNCATE store_management; TRUNCATE store_config; TRUNCATE content_entries; TRUNCATE outbox; TRUNCATE stored_files",
  );
  await seedTest(db);
});
async function intent(key = randomUUID(), code?: string): Promise<OrderToSave> {
  const p = (await store.read()).products[0];
  return {
    orderNumber: `TEST-${randomUUID().slice(0, 20)}`,
    idempotencyKey: key,
    requestFingerprint: "a".repeat(64),
    customerName: "isolated",
    phone: "09123456789",
    address: "test address",
    items: [{ productId: p.id, name: p.name, quantity: 1, unitPrice: p.price }],
    total: code ? Math.floor(p.price * 0.9) : p.price,
    status: "pending",
    couponCode: code,
  };
}
const change = (id: number, status: "cancelled" | "confirmed") =>
  db.transaction(async (raw) =>
    updateManagedOrder(
      {} as ManagementState,
      raw as unknown as typeof db,
      id,
      status,
    ),
  );
test("real PostgreSQL: last unit cannot be purchased concurrently", async () => {
  await store.mutate(async (s) => {
    s.products[0].stock = 1;
  });
  const inputs = await Promise.all(Array.from({ length: 8 }, () => intent()));
  const result = await Promise.allSettled(inputs.map((i) => store.save(i)));
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await store.read()).products[0].stock, 0);
  assert.equal((await db.select().from(ordersTable)).length, 1);
});
test("dedicated runtime role can use the new checkout without access to the retired document", async () => {
  await pool.query(
    "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='varsa_api') THEN CREATE ROLE varsa_api NOLOGIN; END IF; END $$",
  );
  await pool.query(
    await readFile(
      new URL("../../../ops/database-runtime-grants.sql", import.meta.url),
      "utf8",
    ),
  );
  const restricted = new pg.Pool({
    connectionString: databaseUrl,
    options: "-c role=varsa_api",
    max: 2,
  });
  try {
    const runtime = drizzle(restricted) as unknown as typeof db;
    const runtimeStore = createManagementStore(runtime);
    assert.equal((await runtimeStore.read()).products.length, 12);
    assert((await runtimeStore.save(await intent())).id);
    await restricted.query('SELECT id FROM card_transfer_receipts LIMIT 0');
    await restricted.query('SELECT next_offset FROM bale_bot_state LIMIT 0');
    await assert.rejects(() =>
      restricted.query("SELECT * FROM store_management"),
    );
    await assert.rejects(() => restricted.query("DELETE FROM orders"));
    await assert.rejects(() => restricted.query("INSERT INTO admin_accounts(id,username,password_hash) VALUES(gen_random_uuid(),'forbidden','invalid')"));
    await assert.rejects(() => restricted.query("DELETE FROM security_audit"));
    const previousEnv=process.env.NODE_ENV;
    process.env.NODE_ENV='production';
    try {await verifyRuntimeRole(runtime);await assert.rejects(()=>verifyRuntimeRole(db));}
    finally{if(previousEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousEnv;}
  } finally {
    await restricted.end();
  }
});

test('real PostgreSQL: concurrent receipt uploads and approval callbacks commit one payment decision', async () => {
  const { submitReceipt, reviewReceipt } = await import('../src/modules/payments/service');
  const { cardTransferReceipts, orderDetails } = await import('@workspace/db/schema');
  const sharp = (await import('sharp')).default;
  const names = ['CARD_TRANSFER_ENABLED','CARD_TRANSFER_NUMBER','CARD_TRANSFER_ACCOUNT_NAME','CARD_TRANSFER_BANK_NAME','BALE_BOT_TOKEN','BALE_ADMIN_CHAT_ID','BALE_ADMIN_USER_IDS'];
  const previous = Object.fromEntries(names.map(name => [name,process.env[name]]));
  Object.assign(process.env, { CARD_TRANSFER_ENABLED:'true', CARD_TRANSFER_NUMBER:'6037990000000000', CARD_TRANSFER_ACCOUNT_NAME:'isolated', CARD_TRANSFER_BANK_NAME:'isolated', BALE_BOT_TOKEN:'unused-test-token', BALE_ADMIN_CHAT_ID:'123', BALE_ADMIN_USER_IDS:'123' });
  try {
    const order = await store.save(await intent());
    await db.execute(sql`UPDATE order_details SET meta=jsonb_set(meta,'{shippingConfigured}','true'::jsonb) WHERE order_id=${order.id}`);
    const data = (await sharp({create:{width:16,height:16,channels:3,background:'#ffc521'}}).png().toBuffer()).toString('base64');
    const objects = new Map<string,Buffer>();
    const storage = { async put(key:string,bytes:Buffer){objects.set(key,bytes);},async get(key:string){return objects.get(key)!;},async ready(){} };
    const attempts = await Promise.allSettled(Array.from({length:4},()=>submitReceipt(db,order.id,data,'image/png',storage)));
    const uploaded = attempts.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof submitReceipt>>> => r.status==='fulfilled').map(r=>r.value);
    assert.equal(uploaded.length,2);
    for(const attempt of attempts) if(attempt.status==='rejected') assert.equal(attempt.reason.status,429);
    assert.equal(new Set(uploaded.map(r=>r.id)).size,1);
    assert.equal((await db.select().from(cardTransferReceipts)).length,1);
    const id=uploaded[0].id;
    await Promise.all(Array.from({length:8},()=>db.transaction(tx=>reviewReceipt(tx as unknown as typeof db,id,'approved','bale:123'))));
    assert.equal((await db.select().from(orderDetails).where(eq(orderDetails.orderId,order.id)))[0].paymentStatus,'paid');
    assert.equal((await db.select().from(ordersTable).where(eq(ordersTable.id,order.id)))[0].status,'confirmed');
    assert.equal((await db.select().from(outbox).where(eq(outbox.kind,'payment.reviewed'))).length,1);
    assert.equal((await db.select().from(outbox).where(eq(outbox.kind,'order.status'))).length,1);
  } finally {for(const name of names){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];}}
});

test('real PostgreSQL serializes TOTP consumption across two API instances and revokes shared sessions',async()=>{
 const previous=process.env.SESSION_SECRET;process.env.SESSION_SECRET=randomUUID();
 const credentials=await seedAdmin(db);
 const servers:ReturnType<ReturnType<typeof express>['listen']>[]=[];
 try{
  const bases:string[]=[];
  for(let i=0;i<2;i++){
   const app=express();app.use(express.json());mountSecurity(app,db);app.get('/api/protected',(req,res)=>res.status(hasValidAdminToken(req)?200:401).json({}));
   const s=app.listen(0,'127.0.0.1');servers.push(s);await once(s,'listening');const a=s.address();assert(a&&typeof a!=='string');bases.push(`http://127.0.0.1:${a.port}/api`);
  }
  const r=await Promise.all(bases.map(base=>secureFetch(base+'/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(credentials)})));
  assert.deepEqual(r.map(v=>v.status).sort(),[200,401]);
  const cookie=r.find(v=>v.status===200)!.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await fetch(bases[1]+'/protected',{headers:{Cookie:cookie}})).status,200);
  assert.equal((await secureFetch(bases[0]+'/admin/logout',{method:'POST',headers:{Cookie:cookie}})).status,200);
  assert.equal((await fetch(bases[1]+'/protected',{headers:{Cookie:cookie}})).status,401);
 }finally{for(const s of servers){s.closeAllConnections();await new Promise<void>(r=>s.close(()=>r()));}if(previous===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=previous;}
});
test("checkout proceeds while the retired management document and an unrelated SKU are locked", async () => {
  const state = await store.read(),
    other = state.products[1];
  await db.insert(storeManagementTable).values({
    id: "main",
    payload: initialState() as unknown as Record<string, unknown>,
  });
  const blocker = await pool.connect();
  await blocker.query("BEGIN");
  try {
    await blocker.query(
      "SELECT * FROM store_management WHERE id='main' FOR UPDATE",
    );
    await blocker.query(
      "SELECT * FROM product_variants WHERE id=$1 FOR UPDATE",
      [state.products[0].id],
    );
    const input = await intent();
    input.items = [
      {
        productId: other.id,
        name: other.name,
        quantity: 1,
        unitPrice: other.price,
      },
    ];
    input.total = other.price;
    let timeout: ReturnType<typeof setTimeout>;
    try {
      const result = await Promise.race([
        store.save(input),
        new Promise<never>((_r, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Unrelated lock blocked checkout")),
            2000,
          );
        }),
      ]);
      assert(result.id);
    } finally {
      clearTimeout(timeout!);
    }
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
  }
});
test("real PostgreSQL: simultaneous idempotent retry reserves and redeems once", async () => {
  await store.mutate(async (s) => {
    s.products[0].stock = 5;
    s.coupons = [
      {
        id: "c",
        code: "SAVE",
        kind: "percent",
        value: 10,
        minimum: 0,
        expiresAt: "",
        limit: 1,
        used: 0,
        active: true,
      },
    ];
  });
  const input = await intent(randomUUID(), "SAVE");
  const results = await Promise.all(
    Array.from({ length: 8 }, () => store.save(input)),
  );
  assert(results.every((r) => r.id === results[0].id));
  assert.equal((await store.read()).products[0].stock, 4);
  assert.equal((await db.select().from(coupons))[0].used, 1);
  assert.equal((await db.select().from(reservations)).length, 1);
});
test("real PostgreSQL: coupon global cap serializes competing orders", async () => {
  await store.mutate(async (s) => {
    s.coupons = [
      {
        id: "c",
        code: "SAVE",
        kind: "percent",
        value: 10,
        minimum: 0,
        expiresAt: "",
        limit: 1,
        used: 0,
        active: true,
      },
    ];
  });
  const inputs = await Promise.all(
    Array.from({ length: 6 }, () => intent(randomUUID(), "SAVE")),
  );
  const results = await Promise.allSettled(inputs.map((i) => store.save(i)));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
});
test("real PostgreSQL: cancellation and expiry release a reservation once", async () => {
  await store.mutate(async (s) => {
    s.products[0].stock = 1;
  });
  const order = await store.save(await intent());
  await db.update(reservations).set({ expiresAt: new Date(Date.now() - 1000) });
  await Promise.all([
    change(order.id, "cancelled"),
    expireOne(db),
    change(order.id, "cancelled"),
    expireOne(db),
  ]);
  assert.equal((await store.read()).products[0].stock, 1);
  assert.equal((await db.select().from(reservations))[0].state, "released");
});
test("snapshots survive product edits and manual order is unpaid", async () => {
  const input = await intent();
  await store.mutate(async (s) => {
    s.products[0].name = "name-at-checkout";
  });
  const order = await store.save(input);
  const [before] = await db.select().from(orderItems);
  assert.equal(before.snapshot.name, "name-at-checkout");
  assert.deepEqual(order.items[0], before.snapshot);
  await store.mutate(async (s) => {
    s.products[0].price += 10;
    s.products[0].name = "changed";
  });
  const [after] = await db.select().from(orderItems);
  assert.deepEqual(after.snapshot, before.snapshot);
  assert.equal(after.unitPrice, input.items[0].unitPrice);
  const detail = await pool.query(
    "SELECT payment_status,payment_method,currency FROM order_details WHERE order_id=$1",
    [order.id],
  );
  assert.deepEqual(detail.rows[0], {
    payment_status: "unpaid",
    payment_method: "manual",
    currency: "IRT",
  });
});
test("workers reclaim a stopped lease and fence stale acknowledgements", async () => {
  await db
    .insert(outbox)
    .values({ id: "job", kind: "order.created", payload: {} });
  const old = await claimJob(db, 10);
  assert(old);
  await new Promise((r) => setTimeout(r, 30));
  const next = await claimJob(db);
  assert(next);
  assert.equal(next.attempts, 2);
  assert.equal(await finishJob(db, old), false);
  assert.equal(await finishJob(db, next), true);
  assert.equal(await claimJob(db), null);
});
test("multiple workers claim distinct jobs; failures reach a bounded terminal state", async () => {
  for (let i = 0; i < 6; i++)
    await db
      .insert(outbox)
      .values({ id: `j${i}`, kind: "order.created", payload: {} });
  const jobs = await Promise.all(Array.from({ length: 6 }, () => claimJob(db)));
  assert.equal(new Set(jobs.map((j) => j?.id)).size, 6);
  await db.insert(outbox).values({
    id: "bad",
    kind: "unknown",
    payload: {},
    attempts: MAX_ATTEMPTS - 1,
  });
  await processOne(db);
  assert.equal(
    (await db.select().from(outbox).where(eq(outbox.id, "bad")))[0].status,
    "failed",
  );
});
test("S3-compatible copy verifies bytes, preserves mapping and enforces private ownership", async () => {
  const bytes = imageBytes(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZfoAAAAASUVORK5CYII=",
    "image/png",
  );
  await pool.query(
    "INSERT INTO customers(id,phone,profile) VALUES ('owner','09121111111','{}') ON CONFLICT DO NOTHING",
  );
  const service = fileService(db);
  await service.save("public-image", bytes, "image/png");
  await service.save("private-image", bytes, "image/png", "owner");
  await service.save("public-image", bytes, "image/png");
  assert.deepEqual((await service.read("public-image"))?.bytes, bytes);
  await assert.rejects(() => service.read("private-image", "other"));
  await assert.rejects(() => service.read("private-image"));
  assert.deepEqual(
    (await service.read("private-image", "owner"))?.bytes,
    bytes,
  );
  await s3Storage().ready();
});
test("upgrade backfill reconciles old IDs, totals and stock and can run repeatedly", async () => {
  await pool.query(
    "TRUNCATE commerce_products CASCADE; TRUNCATE coupons CASCADE; TRUNCATE store_config; TRUNCATE content_entries",
  );
  const legacy = initialState();
  legacy.products[0].stock = 7;
  await db.insert(storeManagementTable).values({
    id: "main",
    payload: legacy as unknown as Record<string, unknown>,
  });
  const report = await backfillCommerce(db);
  assert.equal(report.products, 12);
  assert.equal((await store.read()).products[0].stock, 7);
  assert((await backfillCommerce(db)).alreadyMigrated);
  assert.deepEqual(
    (await db.select().from(storeManagementTable))[0].payload,
    legacy,
  );
  await migrateTest({ exec: async (s) => pool.query(s) });
  assert.equal((await db.select().from(variants)).length, 12);
});
test("failed backfill rolls back every new row and preserves its legacy source", async () => {
  await pool.query(
    "TRUNCATE commerce_products CASCADE; TRUNCATE coupons CASCADE; TRUNCATE store_config; TRUNCATE content_entries",
  );
  const source = initialState();
  source.products[1].weight_unit = "unsupported-unit";
  await db.insert(storeManagementTable).values({
    id: "main",
    payload: source as unknown as Record<string, unknown>,
  });
  await assert.rejects(() => backfillCommerce(db));
  assert.equal((await db.select().from(variants)).length, 0);
  assert.deepEqual(
    (await db.select().from(storeManagementTable))[0].payload,
    source,
  );
  assert.equal(
    (await pool.query("SELECT count(*)::int AS n FROM store_config")).rows[0].n,
    0,
  );
});
test("real migration command upgrades representative legacy orders, customers, support and Base64 files", async () => {
  await pool.query(
    "TRUNCATE orders CASCADE; TRUNCATE commerce_products CASCADE; TRUNCATE coupons CASCADE; TRUNCATE store_config; TRUNCATE content_entries; TRUNCATE customers CASCADE",
  );
  const legacy = initialState(),
    p = legacy.products[0];
  p.stock = 3;
  legacy.articles = [];
  legacy.legacyArticlesEnabled = false;
  const originalItems = [
    {
      productId: p.id,
      name: "historical product name",
      quantity: 2,
      unitPrice: 100,
    },
  ];
  const row = await pool.query(
    "INSERT INTO orders(order_number,customer_name,phone,address,items,total) VALUES ('OLD-ORDER','historical customer','09123456789','historical address',$1,220) RETURNING id",
    [JSON.stringify(originalItems)],
  );
  const id = row.rows[0].id;
  legacy.orderMeta[String(id)] = {
    subtotal: 200,
    total: 220,
    discount: 10,
    shipping: 30,
    couponCode: "",
    shippingConfigured: true,
    trackingCode: "old-tracking",
    reserved: true,
    inventoryTracked: true,
    stockItems: { [p.id]: 2 },
  };
  await db.insert(storeManagementTable).values({
    id: "main",
    payload: legacy as unknown as Record<string, unknown>,
  });
  const profile = {
    name: "legacy",
    email: "",
    smsUpdates: false,
    addresses: [
      {
        id: "address",
        label: "home",
        recipient: "owner",
        phone: "09123456789",
        province: "test",
        city: "test",
        address: "old address",
        postalCode: "1234567890",
        isDefault: true,
      },
    ],
    favorites: [p.id],
  };
  await pool.query(
    "INSERT INTO customers(id,phone,profile) VALUES ($1,$2,$3)",
    ["legacy-owner", "09123456789", JSON.stringify(profile)],
  );
  const message = {
    id: "message",
    author: "customer",
    text: "historical conversation",
    images: [],
    createdAt: "2026-01-01T00:00:00Z",
  };
  await pool.query(
    "INSERT INTO customer_cases(id,customer_id,kind,status,payload) VALUES ('legacy-case','legacy-owner','ticket','waiting_admin',$1)",
    [
      JSON.stringify({
        subject: "old support",
        resolution: "",
        messages: [message],
      }),
    ],
  );
  const data =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZfoAAAAASUVORK5CYII=";
  await pool.query(
    "INSERT INTO store_media(id,mime,data) VALUES ('legacy-public','image/png',$1)",
    [data],
  );
  await pool.query(
    "INSERT INTO customer_media(id,customer_id,mime,data) VALUES ('legacy-private','legacy-owner','image/png',$1)",
    [data],
  );
  const run = async () => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/migrate-commerce.ts", "--copy-files"],
      {
        cwd: process.cwd(),
        windowsHide: true,
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          MIGRATION_TARGET_ACK: "isolated-or-approved",
          NODE_ENV: "test",
        },
      },
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", () => {});
    const [code] = await once(child, "exit");
    assert.equal(code, 0, output);
    return output
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line));
  };
  const report = await run();
  assert.equal(report[0].orders, 1);
  assert.equal(report[0].orderTotal, 220);
  assert.equal(report[0].messages, 1);
  assert.equal(report[1].verified, true);
  assert.equal(report[1].privateCount, 1);
  const detail = await pool.query(
    "SELECT * FROM order_details WHERE order_id=$1",
    [id],
  );
  assert.equal(detail.rows[0].meta.shipping, 30);
  assert.equal(detail.rows[0].meta.discount, 10);
  assert.equal(detail.rows[0].address_snapshot.address, "historical address");
  const line = await pool.query("SELECT * FROM order_items WHERE order_id=$1", [
    id,
  ]);
  assert.equal(line.rows[0].snapshot.name, "historical product name");
  assert.equal(line.rows[0].unit_price, 100);
  assert.equal(line.rows[0].snapshot.legacyWeightUnknown, true);
  assert.equal(
    (
      await pool.query(
        "SELECT data FROM customer_media WHERE id='legacy-private'",
      )
    ).rows[0].data,
    data,
  );
  assert.equal(
    (await pool.query("SELECT payload FROM store_management WHERE id='main'"))
      .rows[0].payload.products[0].stock,
    3,
  );
  assert.equal(
    (await pool.query("SELECT body FROM case_messages WHERE id='message'"))
      .rows[0].body,
    message.text,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM customer_addresses WHERE customer_id='legacy-owner'",
      )
    ).rows[0].n,
    1,
  );
  assert.equal((await run())[0].alreadyMigrated, true);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM order_items WHERE order_id=$1",
        [id],
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(() =>
    fileService(db).read("legacy-private", "intruder"),
  );
  assert.deepEqual(
    (await fileService(db).read("legacy-private", "legacy-owner"))?.bytes,
    Buffer.from(data, "base64"),
  );
});
test("a terminated worker process is recovered by a new independent worker", async () => {
  await db
    .insert(outbox)
    .values({ id: "restart-job", kind: "order.created", payload: {} });
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    NODE_ENV: "test",
    LOG_LEVEL: "fatal",
  };
  const script =
    "import {db} from '@workspace/db'; import {claimJob} from './src/modules/notifications/queue.ts'; await claimJob(db,10); process.exit(0);";
  const crashed = spawn(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", script],
    { cwd: process.cwd(), env, windowsHide: true, stdio: "ignore" },
  );
  assert.equal((await once(crashed, "exit"))[0], 0);
  assert.equal(
    (await db.select().from(outbox).where(eq(outbox.id, "restart-job")))[0]
      .status,
    "processing",
  );
  const worker = spawn(process.execPath, ["--import", "tsx", "src/worker.ts"], {
    cwd: process.cwd(),
    env,
    windowsHide: true,
    stdio: "ignore",
  });
  try {
    let completed = false;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const [job] = await db
        .select()
        .from(outbox)
        .where(eq(outbox.id, "restart-job"));
      if (job.status === "completed") {
        completed = true;
        break;
      }
    }
    assert(completed, "Replacement worker did not recover durable job");
  } finally {
    const exited = once(worker, "exit");
    worker.kill("SIGTERM");
    await exited;
  }
});

test("tracking migration preserves legacy ownership and known shipment data on repeat", async () => {
  const oldDate = new Date("2025-05-07T08:09:10.123Z");
  const source = { ...await intent(), phone: "09129990021" };
  const { couponCode: _code, customerId: _owner, ...values } = source;
  const [legacy, formatted, invalid] = await db.insert(ordersTable).values([
    { ...values, createdAt: oldDate, status: "delivered", phone: "۰۰۹۸۹۱۲ ۹۹۹-۰۰۲۱" },
    { ...values, orderNumber: "LEGACY-SECOND", idempotencyKey: randomUUID(), status: "shipped" },
    { ...values, orderNumber: "LEGACY-INVALID", idempotencyKey: randomUUID(), phone: "invalid" },
  ]).returning();
  await pool.query(`
    INSERT INTO order_details(order_id,meta,address_snapshot,fulfillment_status)
    VALUES($1,$2,$3,'delivered'),($4,$5,$3,'shipped')
  `, [
    legacy.id, { trackingCode: "000031", deliveredAt: "2025-05-10T12:00:00.000Z" },
    { address: values.address }, formatted.id, { shippedAt: "2025-99-99T11:12:13Z" },
  ]);
  const owner = randomUUID();
  await pool.query("INSERT INTO customers(id,phone,profile) VALUES($1,$2,'{}')", [owner, source.phone]);
  await pool.query("INSERT INTO customer_order_links(order_id,customer_id) VALUES($1,$2)", [legacy.id, owner]);
  const migration = await readFile(
    new URL("../../../lib/db/migrations/0012_customer_order_tracking.sql", import.meta.url), "utf8",
  );
  await pool.query(migration);
  await pool.query(migration);
  const result = await pool.query(`
    SELECT o.id,o.phone,o.total,o.address,c.phone AS normalized,c.id AS contact,l.customer_id,
      s.tracking_code,s.shipped_at,s.delivered_at,
      (SELECT count(*)::int FROM order_events e WHERE e.order_id=o.id) AS event_count
    FROM orders o LEFT JOIN customer_contacts c ON o.customer_contact_id=c.id
    LEFT JOIN shipments s ON s.order_id=o.id LEFT JOIN customer_order_links l ON l.order_id=o.id
    ORDER BY o.id
  `);
  const [first, second, third] = result.rows;
  assert.deepEqual(result.rows.map((row) => row.id), [legacy.id, formatted.id, invalid.id]);
  assert.equal(first.contact, second.contact);
  assert.equal(first.normalized, source.phone);
  assert.equal(first.phone, legacy.phone);
  assert.equal(first.customer_id, owner);
  assert.equal(first.address, values.address);
  assert.equal(first.total, values.total);
  assert.equal(first.tracking_code, "000031");
  assert.equal(first.delivered_at.toISOString(), "2025-05-10T12:00:00.000Z");
  assert.equal(first.shipped_at, null);
  assert.equal(second.shipped_at, null);
  assert.equal(third.contact, null);
  assert.deepEqual(result.rows.map((row) => row.event_count), [1, 1, 1]);
});
