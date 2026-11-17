import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { once } from "node:events";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { migrateTest } from "./commerce-fixture";
import { mountSecurity, secureFetch } from "./security-fixture";
import {
  hashPassword,
  hashToken,
  hasValidAdminToken,
  totpFor,
  decryptSecret,
} from "../src/lib/admin-security";
import {
  clientNetwork,
  trustedProxyAddresses,
} from "../src/lib/admin-login-limit";
import { validateProductionConfig } from "../src/lib/http-security";
import { encodeUpload } from "../src/modules/files/storage";
import { fileService } from "../src/modules/files/storage";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { reserveSms } from "../src/lib/sms-budget";

const pg = new PGlite(),
  database = drizzle(pg) as unknown as Parameters<typeof mountSecurity>[1];
const app = express();
app.set("trust proxy", false);
app.use(express.json({ limit: "6mb" }));
mountSecurity(app, database);
app.get("/api/protected", (req, res) =>
  res
    .status(hasValidAdminToken(req) ? 200 : 401)
    .json({ ok: hasValidAdminToken(req) }),
);
let server: ReturnType<typeof app.listen>,
  base: string,
  id: string,
  passwordHash: string;
const password = "isolated-secure-password";
const oldEnv = { ...process.env };
before(async () => {
  process.env.SESSION_SECRET = randomBytes(32).toString("hex");
  process.env.ADMIN_MFA_KEY = randomBytes(32).toString("hex");
  process.env.NODE_ENV = "test";
  await migrateTest(pg);
  passwordHash = await hashPassword(password);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const a = server.address();
  assert(a && typeof a !== "string");
  base = `http://127.0.0.1:${a.port}/api`;
});
beforeEach(async () => {
  await pg.exec(
    "TRUNCATE admin_accounts CASCADE;TRUNCATE security_limits;TRUNCATE security_audit;TRUNCATE stored_files",
  );
  id = randomUUID();
  await database.execute(
    sql`INSERT INTO admin_accounts(id,username,password_hash) VALUES(${id},'operator',${passwordHash})`,
  );
});
after(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await pg.close();
  for (const k of Object.keys(process.env))
    if (!(k in oldEnv)) delete process.env[k];
  Object.assign(process.env, oldEnv);
});
async function request(
  path: string,
  body?: unknown,
  cookie?: string,
  headers: Record<string, string> = {},
) {
  const r = await secureFetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: r.status,
    body: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
    headers: r.headers,
  };
}
const login = (extra: Record<string, unknown> = {}) =>
  request("/admin/login", { username: "operator", password, ...extra });
async function enroll() {
  const l = await login();
  assert.equal(l.status, 200);
  assert(l.body.enrollmentRequired);
  assert(l.cookie);
  const begin = await request("/admin/mfa/begin", { password }, l.cookie);
  assert.equal(begin.status, 200);
  const confirmation = await request(
    "/admin/mfa/confirm",
    { password, newCode: totpFor(begin.body.secret).generate() },
    l.cookie,
  );
  assert.equal(confirmation.status, 200);
  return {
    cookie: confirmation.cookie!,
    secret: begin.body.secret as string,
    codes: confirmation.body.recoveryCodes as string[],
    oldCookie: l.cookie!,
  };
}
test("explicit password-only mode accepts the password, rejects wrong passwords and revokes its sessions when switched off", async () => {
  const previous = process.env.ADMIN_PASSWORD_ONLY;
  try {
    process.env.ADMIN_PASSWORD_ONLY = "true";
    assert.equal((await request('/admin/login-options')).body.passwordOnly, true);
    assert.equal((await login({ password: 'wrong-password' })).status, 401);
    const l = await login();
    assert.equal(l.body.authenticated, true);
    assert.equal(l.body.enrollmentRequired, false);
    assert(l.cookie?.startsWith('varsa_admin_session=p_'));
    assert.equal((await request('/protected', undefined, l.cookie)).status, 200);
    process.env.ADMIN_PASSWORD_ONLY = "false";
    assert.equal((await request('/protected', undefined, l.cookie)).status, 401);
    assert.equal((await login()).body.enrollmentRequired, true);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_PASSWORD_ONLY;
    else process.env.ADMIN_PASSWORD_ONLY = previous;
  }
});
test("password-only mode preserves existing MFA and restoring the policy still requires a second factor", async () => {
  await enroll();
  const previous = process.env.ADMIN_PASSWORD_ONLY;
  try {
    process.env.ADMIN_PASSWORD_ONLY = 'true';
    const l = await login();
    assert.equal(l.body.authenticated, true);
    const account = (await database.execute<{totp_secret: string}>(sql`SELECT totp_secret FROM admin_accounts WHERE id=${id}`)).rows[0];
    assert(account.totp_secret);
    process.env.ADMIN_PASSWORD_ONLY = 'false';
    assert.equal((await request('/protected', undefined, l.cookie)).status, 401);
    assert.equal((await login({passwordOnly: true})).status, 401);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_PASSWORD_ONLY;
    else process.env.ADMIN_PASSWORD_ONLY = previous;
  }
});
test("Argon2id account and unconfirmed enrollment cannot access panel; secrets are encrypted and no tokens returned", async () => {
  assert.match(passwordHash, /^\$argon2id\$/);
  const l = await login();
  assert.equal(l.body.authenticated, false);
  assert(!("token" in l.body));
  assert.equal((await request("/protected", undefined, l.cookie)).status, 401);
  const b = await request("/admin/mfa/begin", { password }, l.cookie);
  const a = (
    await database.execute<{ pending_secret: string; totp_secret: null }>(
      sql`SELECT pending_secret,totp_secret FROM admin_accounts`,
    )
  ).rows[0];
  assert.equal(a.totp_secret, null);
  assert.notEqual(a.pending_secret, b.body.secret);
  assert.equal(decryptSecret(a.pending_secret), b.body.secret);
  assert.equal(
    (
      await request(
        "/admin/mfa/confirm",
        { password, newCode: "000000" },
        l.cookie,
      )
    ).status,
    401,
  );
  assert.equal((await request("/protected", undefined, l.cookie)).status, 401);
});

test("local temporary codes require password, expire, rotate and are single use", async () => {
  const previous = process.env.ADMIN_AUTH_DEV_OTP;
  process.env.ADMIN_AUTH_DEV_OTP = "true";
  process.env.NODE_ENV = "development";
  try {
    assert.equal(
      (await request("/admin/login-options")).body.temporaryCodeEnabled,
      true,
    );
    assert.equal(
      (
        await request("/admin/temporary-code", {
          username: "operator",
          password: "wrong",
        })
      ).status,
      401,
    );
    const issue = () =>
      request("/admin/temporary-code", { username: "operator", password });
    const first = await issue();
    assert.match(first.body.code, /^\d{6}$/);
    await database.execute(
      sql`UPDATE admin_accounts SET pending_until=now()-interval '1 second'`,
    );
    assert.equal((await login({ code: first.body.code })).status, 401);
    const second = await issue();
    const results = await Promise.all([
      login({ code: second.body.code }),
      login({ code: second.body.code }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
    const success = results.find((r) => r.status === 200)!;
    assert.equal(success.body.authenticated, true);
    assert.equal(success.body.enrollmentRequired, false);
    assert.equal(
      (await request("/protected", undefined, success.cookie)).status,
      200,
    );
    assert.equal((await login({ code: second.body.code })).status, 401);
  } finally {
    process.env.NODE_ENV = "test";
    if (previous === undefined) delete process.env.ADMIN_AUTH_DEV_OTP;
    else process.env.ADMIN_AUTH_DEV_OTP = previous;
  }
});

test("temporary codes work for enrolled accounts and stay disabled outside opted-in development", async () => {
  await enroll();
  const previous = process.env.ADMIN_AUTH_DEV_OTP;
  try {
    process.env.ADMIN_AUTH_DEV_OTP = "true";
    assert.equal(
      (
        await request("/admin/temporary-code", {
          username: "operator",
          password,
        })
      ).status,
      404,
    );
    process.env.NODE_ENV = "development";
    const issued = await request("/admin/temporary-code", {
      username: "operator",
      password,
    });
    assert.equal(issued.status, 200);
    process.env.NODE_ENV = "production";
    assert.equal(
      (await request("/admin/login-options")).body.temporaryCodeEnabled,
      false,
    );
    assert.equal(
      (
        await request("/admin/temporary-code", {
          username: "operator",
          password,
        })
      ).status,
      404,
    );
    assert.equal((await login({ code: issued.body.code })).status, 401);
    process.env.NODE_ENV = "development";
    assert.equal(
      (await login({ code: issued.body.code })).body.authenticated,
      true,
    );
    delete process.env.ADMIN_AUTH_DEV_OTP;
    assert.equal(
      (await request("/admin/login-options")).body.temporaryCodeEnabled,
      false,
    );
  } finally {
    process.env.NODE_ENV = "test";
    if (previous === undefined) delete process.env.ADMIN_AUTH_DEV_OTP;
    else process.env.ADMIN_AUTH_DEV_OTP = previous;
  }
});
test("MFA confirmation rotates cookie, hashes recovery codes and invalidates enrollment session", async () => {
  const e = await enroll();
  assert.equal((await request("/protected", undefined, e.cookie)).status, 200);
  assert.equal(
    (await request("/protected", undefined, e.oldCookie)).status,
    401,
  );
  const rows = (
    await database.execute<{ token_hash: string }>(
      sql`SELECT token_hash FROM admin_sessions`,
    )
  ).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].token_hash, hashToken(e.cookie.split("=")[1]));
  const a = (
    await database.execute<{ recovery_hashes: string[] }>(
      sql`SELECT recovery_hashes FROM admin_accounts`,
    )
  ).rows[0];
  assert.equal(a.recovery_hashes.length, 10);
  assert(!a.recovery_hashes.includes(e.codes[0]));
  assert.match(
    (await login({ recoveryCode: e.codes[0] })).headers.get("set-cookie")!,
    /HttpOnly/,
  );
});
test("password alone and replay of enrollment TOTP cannot log in; concurrent TOTP succeeds once", async () => {
  const e = await enroll();
  assert.equal((await login()).status, 401);
  assert.equal(
    (await login({ code: totpFor(e.secret).generate() })).status,
    401,
  );
  await database.execute(sql`UPDATE admin_accounts SET last_counter=-1`);
  const code = totpFor(e.secret).generate();
  const results = await Promise.all([login({ code }), login({ code })]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
});
test("recovery codes are single use under concurrency and revoke existing sessions", async () => {
  const e = await enroll();
  const results = await Promise.all([
    login({ recoveryCode: e.codes[0] }),
    login({ recoveryCode: e.codes[0] }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
  assert.equal((await request("/protected", undefined, e.cookie)).status, 401);
});
test("real logout, absolute expiry and inactivity independently reject sessions", async () => {
  const e = await enroll();
  assert.equal((await request("/admin/logout", {}, e.cookie)).status, 200);
  assert.equal((await request("/protected", undefined, e.cookie)).status, 401);
  const l = await login({ recoveryCode: e.codes[0] });
  await database.execute(
    sql`UPDATE admin_sessions SET expires_at=now()-interval '1 second'`,
  );
  assert.equal((await request("/protected", undefined, l.cookie)).status, 401);
  const l2 = await login({ recoveryCode: e.codes[1] });
  await database.execute(
    sql`UPDATE admin_sessions SET last_seen=now()-interval '21 minutes'`,
  );
  assert.equal((await request("/protected", undefined, l2.cookie)).status, 401);
});
test("password change requires reauthentication and revokes all prior sessions", async () => {
  const e = await enroll();
  assert.equal(
    (
      await request(
        "/admin/password",
        {
          password: "wrong",
          newPassword: "another-secure-password",
          recoveryCode: e.codes[0],
        },
        e.cookie,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/admin/password",
        {
          password,
          newPassword: "another-secure-password",
          recoveryCode: e.codes[0],
        },
        e.cookie,
      )
    ).status,
    200,
  );
  assert.equal((await request("/protected", undefined, e.cookie)).status, 401);
  assert.equal((await login({ recoveryCode: e.codes[1] })).status, 401);
  assert.equal(
    (
      await login({
        password: "another-secure-password",
        recoveryCode: e.codes[1],
      })
    ).status,
    200,
  );
});
test("MFA removal requires password plus factor, revokes sessions and forces re-enrollment", async () => {
  const e = await enroll();
  assert.equal(
    (await request("/admin/mfa/disable", { password }, e.cookie)).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/admin/mfa/disable",
        { password, recoveryCode: e.codes[0] },
        e.cookie,
      )
    ).status,
    200,
  );
  assert.equal((await request("/protected", undefined, e.cookie)).status, 401);
  const l = await login();
  assert.equal(l.body.enrollmentRequired, true);
  assert.equal((await request("/protected", undefined, l.cookie)).status, 401);
});
test("admin and customer cookies cannot be substituted, and old signed bearer tokens are rejected", async () => {
  const e = await enroll();
  const token = e.cookie.split("=")[1];
  assert.equal(
    (await request("/protected", undefined, "varsa_customer_session=" + token))
      .status,
    401,
  );
  const payload = Buffer.from(
    JSON.stringify({ expiresAt: Date.now() + 3600000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", process.env.SESSION_SECRET!)
    .update(payload)
    .digest("base64url");
  assert.equal(
    (
      await request("/protected", undefined, undefined, {
        Authorization: `Bearer ${payload}.${signature}`,
      })
    ).status,
    401,
  );
});
test("CSRF rejects absent Origin without token, malicious origins, mismatches and forms; safe token works without Origin", async () => {
  const missing = await fetch(base + "/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "operator", password }),
  });
  assert.equal(missing.status, 403);
  assert.equal((await login()).status, 200);
  assert.equal(
    (
      await request(
        "/admin/login",
        { username: "operator", password },
        undefined,
        { Origin: "https://attacker.test" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/admin/login",
        { username: "operator", password },
        undefined,
        { "Sec-Fetch-Site": "cross-site" },
      )
    ).status,
    403,
  );
  const r = await secureFetch(base + "/admin/login", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "{}",
  });
  assert.equal(r.status, 415);
  const fake = await fetch(base + "/admin/logout", {
    method: "POST",
    headers: { Cookie: "varsa_csrf=fake", "X-Varsa-CSRF": "fake" },
  });
  assert.equal(fake.status, 403);
});
test("durable account throttling cannot be evaded with forged forwarding headers", async () => {
  for (let i = 0; i < 8; i++)
    assert.equal(
      (
        await request(
          "/admin/login",
          { username: "operator", password: "wrong" },
          undefined,
          { "X-Forwarded-For": `198.51.100.${i}`, "X-Real-IP": `192.0.2.${i}` },
        )
      ).status,
      401,
    );
  assert.equal((await login()).status, 429);
  assert.equal(
    (await database.execute(sql`SELECT * FROM security_limits`)).rows.length,
    3,
  );
});
test("proxy configuration stays precise and canonicalizes IPv6 networks", () => {
  for (const value of [
    "true",
    "1",
    "*",
    "loopback",
    "10.0.0.0/8",
    "127.0.0.1,",
  ])
    assert.throws(() => trustedProxyAddresses(value));
  assert.deepEqual(trustedProxyAddresses("127.0.0.1,::1"), [
    "127.0.0.1",
    "::1",
  ]);
  assert.equal(clientNetwork("::ffff:c000:201"), "192.0.2.1");
  assert.equal(
    clientNetwork("2001:db8:1:1::1"),
    clientNetwork("2001:db8:1:1::99"),
  );
});
test("production refuses incomplete or development authentication configuration", () => {
  process.env.NODE_ENV = "production";
  try {
    assert.throws(() => validateProductionConfig());
  } finally {
    process.env.NODE_ENV = "test";
  }
});
test("production accepts a complete safe configuration and rejects each unsafe override", () => {
  const snapshot = { ...process.env };
  try {
    Object.assign(process.env, {
      NODE_ENV: "production",
      SESSION_SECRET: "a".repeat(64),
      CUSTOMER_AUTH_SECRET: "b".repeat(64),
      ADMIN_MFA_KEY: "c".repeat(64),
      PUBLIC_ORIGIN: "https://varsa.example.test",
      ALLOWED_ORIGINS: "",
      CUSTOMER_ALLOWED_ORIGINS: "",
      CUSTOMER_AUTH_DEV_OTP: "false",
      S3_ENDPOINT: "https://objects.example.test",
      S3_BUCKET: "private-test",
      S3_ACCESS_KEY_ID: "fixture-key",
      S3_SECRET_ACCESS_KEY: "fixture-secret",
      CUSTOMER_SMS_URL: "https://sms.example.test/send",
      CUSTOMER_SMS_TOKEN: "fixture-token",
    });
    delete process.env.VARSA_ADMIN_PASSWORD;
    validateProductionConfig();
    for (const [key, value] of [
      ["PUBLIC_ORIGIN", "http://varsa.example.test"],
      ["PUBLIC_ORIGIN", "https://varsa.example.test/path"],
      ["ALLOWED_ORIGINS", "*"],
      ["CUSTOMER_AUTH_DEV_OTP", "true"],
      ["ADMIN_AUTH_DEV_OTP", "true"],
      ["VARSA_ADMIN_PASSWORD", "old"],
      ["ADMIN_MFA_KEY", "short"],
      ["CUSTOMER_SMS_URL", "https://user:secret@sms.example.test"],
      ["UPLOAD_TOTAL_BYTES", "0"],
      ["SESSION_SECRET", "short"],
    ] as const) {
      const previous = process.env[key];
      process.env[key] = value;
      assert.throws(() => validateProductionConfig(), key);
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in snapshot)) delete process.env[key];
    Object.assign(process.env, snapshot);
  }
});
test("production admin and CSRF cookies require Secure and HttpOnly", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const r = await login();
    assert.equal(r.status, 200);
    assert.match(r.headers.get("set-cookie")!, /Secure/);
    assert.match(r.headers.get("set-cookie")!, /HttpOnly/);
    assert.match(r.headers.get("set-cookie")!, /SameSite=Strict/);
    const c = await fetch(base + "/csrf");
    assert.match(c.headers.get("set-cookie")!, /Secure/);
  } finally {
    process.env.NODE_ENV = previous;
  }
});
test("security migration revokes direct browser-role grants, not only PUBLIC grants", async () => {
  await pg.exec(
    "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN;END IF;END $$;GRANT SELECT ON admin_accounts,admin_sessions,security_limits,security_audit,security_storage_lock TO anon;",
  );
  await pg.exec(
    await readFile(
      new URL("../../../lib/db/migrations/0010_security.sql", import.meta.url),
      "utf8",
    ),
  );
  for (const table of [
    "admin_accounts",
    "admin_sessions",
    "security_limits",
    "security_audit",
    "security_storage_lock",
  ]) {
    const result = await pg.query<{ allowed: boolean }>(
      "SELECT has_table_privilege($1,$2,$3) AS allowed",
      ["anon", table, "SELECT"],
    );
    assert.equal(result.rows[0].allowed, false);
  }
});
test("strict image decoding rejects fake MIME, corrupt pixels, oversize bytes and dimensions; reencoding strips metadata", async () => {
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "red" },
  })
    .png()
    .withMetadata()
    .toBuffer();
  const clean = await encodeUpload(png.toString("base64"), "image/png");
  assert.equal(clean.mime, "image/webp");
  assert.equal((await sharp(clean.bytes).metadata()).exif, undefined);
  await assert.rejects(() =>
    encodeUpload(png.toString("base64"), "image/jpeg"),
  );
  for (const mime of ["image/svg+xml", "text/html", "application/octet-stream"])
    await assert.rejects(() =>
      encodeUpload(Buffer.from("<svg/>").toString("base64"), mime),
    );
  const huge = await sharp({
    create: { width: 6001, height: 1, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  await assert.rejects(() =>
    encodeUpload(huge.toString("base64"), "image/png"),
  );
  const pixelBomb = await sharp({
    create: { width: 4096, height: 4096, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  await assert.rejects(() =>
    encodeUpload(pixelBomb.toString("base64"), "image/png"),
  );
  await assert.rejects(() =>
    encodeUpload(Buffer.alloc(5 * 1024 * 1024).toString("base64"), "image/png"),
  );
  await assert.rejects(() =>
    encodeUpload(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZfoAAAAASUVORK5CYII=",
      "image/png",
    ),
  );
});
test("atomic global storage reservation prevents quota oversubscription across instances", async () => {
  process.env.UPLOAD_TOTAL_BYTES = "16";
  const objects = new Map<string, Buffer>();
  const storage = {
    put: async (k: string, b: Buffer) => {
      objects.set(k, b);
    },
    get: async (k: string) => objects.get(k)!,
    ready: async () => {},
  };
  try {
    const r = await Promise.allSettled([
      fileService(database, storage).save(
        randomUUID(),
        Buffer.alloc(10),
        "image/webp",
      ),
      fileService(database, storage).save(
        randomUUID(),
        Buffer.alloc(10),
        "image/webp",
      ),
    ]);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal(objects.size, 1);
  } finally {
    delete process.env.UPLOAD_TOTAL_BYTES;
  }
});

test("SMS API and worker budgets share durable hourly and daily caps with audit alerts", async () => {
  const previousHour = process.env.SMS_HOURLY_LIMIT,
    previousDay = process.env.SMS_DAILY_LIMIT;
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (value: unknown) => {
    warnings.push(String(value));
  };
  try {
    process.env.SMS_HOURLY_LIMIT = "2";
    process.env.SMS_DAILY_LIMIT = "100";
    await reserveSms(database, "otp");
    await reserveSms(database, "notification");
    await assert.rejects(
      () => reserveSms(database, "otp"),
      (e: unknown) => (e as { status: number }).status === 429,
    );
    const events = (
      await database.execute<{ event: string }>(
        sql`SELECT event FROM security_audit ORDER BY id`,
      )
    ).rows.map((r) => r.event);
    assert.deepEqual(events, [
      "sms_attempt:otp",
      "sms_attempt:notification",
      "sms_budget_exhausted",
    ]);
    assert.deepEqual(warnings, ["security_alert:sms_budget_exhausted"]);
    await pg.exec("TRUNCATE security_limits;TRUNCATE security_audit");
    process.env.SMS_HOURLY_LIMIT = "100";
    process.env.SMS_DAILY_LIMIT = "1";
    await reserveSms(database, "notification");
    await assert.rejects(() => reserveSms(database, "otp"));
  } finally {
    console.warn = warn;
    if (previousHour === undefined) delete process.env.SMS_HOURLY_LIMIT;
    else process.env.SMS_HOURLY_LIMIT = previousHour;
    if (previousDay === undefined) delete process.env.SMS_DAILY_LIMIT;
    else process.env.SMS_DAILY_LIMIT = previousDay;
  }
});

test("private upload byte quota belongs to the verified account and leaves another account usable", async () => {
  const priorAccount = process.env.UPLOAD_ACCOUNT_BYTES,
    priorTotal = process.env.UPLOAD_TOTAL_BYTES;
  const owner = randomUUID(),
    other = randomUUID(),
    objects = new Map<string, Buffer>();
  const storage = {
    put: async (k: string, b: Buffer) => {
      objects.set(k, b);
    },
    get: async (k: string) => objects.get(k)!,
    ready: async () => {},
  };
  await database.execute(
    sql`INSERT INTO customers(id,phone,profile) VALUES(${owner},'09123330001','{}'),(${other},'09123330002','{}')`,
  );
  try {
    process.env.UPLOAD_ACCOUNT_BYTES = "16";
    process.env.UPLOAD_TOTAL_BYTES = "100";
    const service = fileService(database, storage);
    await service.save(randomUUID(), Buffer.alloc(10), "image/webp", owner);
    await assert.rejects(
      () => service.save(randomUUID(), Buffer.alloc(10), "image/webp", owner),
      (e: unknown) => (e as { status: number }).status === 413,
    );
    await service.save(randomUUID(), Buffer.alloc(10), "image/webp", other);
    assert.equal(objects.size, 2);
  } finally {
    if (priorAccount === undefined) delete process.env.UPLOAD_ACCOUNT_BYTES;
    else process.env.UPLOAD_ACCOUNT_BYTES = priorAccount;
    if (priorTotal === undefined) delete process.env.UPLOAD_TOTAL_BYTES;
    else process.env.UPLOAD_TOTAL_BYTES = priorTotal;
  }
});
