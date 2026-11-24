import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import EmbeddedPostgres from "embedded-postgres";
import { localS3, stopIsolatedPostgres } from "../test/commerce-fixture";

const apiRoot = fileURLToPath(new URL("../", import.meta.url));
const frontRoot = fileURLToPath(new URL("../../varsa-shop/", import.meta.url));
async function freePort() {
  const server = createTcpServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((r) => server.close(() => r()));
  return port;
}
async function run(args: string[], env: NodeJS.ProcessEnv, cwd = apiRoot) {
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true });
  let output = "";
  child.stdout.on("data", (c) => {
    output += c;
  });
  child.stderr.on("data", (c) => {
    output += c;
  });
  const [code] = await once(child, "exit");
  if (code !== 0)
    throw new Error(`Local verification command failed: ${output}`);
  return output;
}
const directory = await mkdtemp(path.join(tmpdir(), "varsa-deployment-"));
const pgPort = await freePort(),
  apiPort = await freePort(),
  password = randomUUID();
const engine = new EmbeddedPostgres({
  databaseDir: path.join(directory, "data"),
  port: pgPort,
  user: "smoke",
  password,
  persistent: true,
  initdbFlags: ["--encoding=UTF8"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
let closeS3: (() => Promise<void>) | undefined,
  api: ReturnType<typeof spawn> | undefined;
const legacy = createServer((_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify([
      {
        id: "smoke-article",
        slug: "local-smoke",
        title: "Local verification",
        excerpt: "Isolated fixture",
        content: "Isolated migration verification",
        image_url: "/products/super-negin-1g.png",
        author: "Test",
        category: "Test",
        read_time: 1,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]),
  );
});
try {
  await engine.initialise();
  await engine.start();
  closeS3 = await localS3();
  legacy.listen(0, "127.0.0.1");
  await once(legacy, "listening");
  const legacyAddress = legacy.address();
  assert(legacyAddress && typeof legacyAddress !== "string");
  const env = {
    ...process.env,
    DATABASE_URL: `postgresql://smoke:${password}@127.0.0.1:${pgPort}/postgres`,
    MIGRATION_TARGET_ACK: "isolated-or-approved",
    SESSION_SECRET: randomUUID(),
    VARSA_ADMIN_PASSWORD: randomUUID(),
    NODE_ENV: "test",
    PORT: String(apiPort),
    LOG_LEVEL: "info",
    SUPABASE_URL: `http://127.0.0.1:${legacyAddress.port}`,
    SUPABASE_ANON_KEY: "local-fixture",
  };
  const migration = await run(
    [
      "dist/migrate-commerce.mjs",
      "--seed-empty",
      "--import-articles",
      "--copy-files",
    ],
    env,
  );
  delete (env as NodeJS.ProcessEnv).SUPABASE_URL;
  delete (env as NodeJS.ProcessEnv).SUPABASE_ANON_KEY;
  legacy.closeAllConnections();
  await new Promise<void>((r) => legacy.close(() => r()));
  let apiLogs = "";
  api = spawn(process.execPath, ["dist/index.mjs"], {
    cwd: apiRoot,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  api.stdout?.on("data", (c) => {
    apiLogs += c;
  });
  api.stderr?.on("data", (c) => {
    apiLogs += c;
  });
  const origin = `http://127.0.0.1:${apiPort}`;
  let healthy = false;
  for (let i = 0; i < 70; i++) {
    try {
      healthy = (
        await fetch(`${origin}/api/readyz`, {
          signal: AbortSignal.timeout(500),
        })
      ).ok;
    } catch {}
    if (healthy) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert(healthy, "Built API not ready");
  assert.equal((await fetch(`${origin}/api/healthz`)).status, 200);
  const products = await (await fetch(`${origin}/api/store/products`)).json();
  assert.equal(products.length, 12);
  const articles = await (await fetch(`${origin}/api/articles`)).json();
  assert.equal(articles[0].id, "smoke-article");
  assert.equal((await fetch(`${origin}/api/admin/management`)).status, 401);
  const csrfResponse = await fetch(`${origin}/api/csrf`),
    csrfToken = (await csrfResponse.json()).csrfToken;
  const sentinel = {
    password: "test-password-must-not-be-logged",
    code: "947261",
    authorization: "Bearer test-session-must-not-be-logged",
    cookie: "varsa_customer_session=test-cookie-must-not-be-logged",
    query: "test-query-must-not-be-logged",
  };
  const headers = {
    "Content-Type": "application/json",
    "X-Varsa-CSRF": csrfToken,
    Cookie:
      csrfResponse.headers.get("set-cookie")!.split(";")[0] +
      "; " +
      sentinel.cookie,
    Authorization: sentinel.authorization,
  };
  const post = (
    endpoint: string,
    body: string,
    extra: Record<string, string> = {},
  ) =>
    fetch(origin + endpoint, {
      method: "POST",
      headers: { ...headers, ...extra },
      body,
    });
  assert.equal(
    (await fetch(origin + "/api/admin/logout", { method: "POST" })).status,
    403,
  );
  // Invalid/oversize unauthenticated upload bytes must not reach JSON parsing.
  for (const path of ["/api/admin/media", "/api/customer/media"]) {
    assert.equal((await post(path, "{")).status, 401);
    assert.equal((await post(path, "x".repeat(7 * 1024 * 1024))).status, 401);
  }
  assert.equal(
    (
      await post(
        "/api/admin/login",
        JSON.stringify({
          username: "missing-account",
          password: sentinel.password,
          code: sentinel.code,
        }),
        { Origin: "https://attacker.test" },
      )
    ).status,
    403,
  );
  for (let i = 0; i < 8; i++)
    assert.equal(
      (
        await post(
          "/api/admin/login?token=" + sentinel.query,
          JSON.stringify({
            username: "missing-account",
            password: sentinel.password,
            code: sentinel.code,
          }),
          { "X-Forwarded-For": `198.51.100.${i}` },
        )
      ).status,
      401,
    );
  assert.equal(
    (
      await post(
        "/api/admin/login",
        JSON.stringify({
          username: "missing-account",
          password: sentinel.password,
        }),
        { "X-Forwarded-For": "192.0.2.222", "X-Real-IP": "192.0.2.221" },
      )
    ).status,
    429,
  );
  assert.equal((await post("/api/contact", "{")).status, 400);
  assert.equal(
    (
      await post(
        "/api/contact",
        JSON.stringify({ message: "x".repeat(140000) }),
      )
    ).status,
    413,
  );
  assert.equal(
    (await post("/api/contact", "{}", { "Content-Type": "text/plain" })).status,
    415,
  );
  const compressed = await fetch(origin + "/api/contact", {
    method: "POST",
    headers: { ...headers, "Content-Encoding": "gzip" },
    body: new Uint8Array(gzipSync("{}")),
  });
  assert.equal(compressed.status, 415);
  const missing = await fetch(origin + "/api/not-a-route");
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("x-powered-by"), null);
  assert.equal(missing.headers.get("x-content-type-options"), "nosniff");
  assert.equal(missing.headers.get("strict-transport-security"), null);
  await new Promise((r) => setTimeout(r, 100));
  assert(
    apiLogs.includes("request completed") ||
      apiLogs.includes("request errored"),
    "Logger probe must actually capture log output",
  );
  for (const value of Object.values(sentinel))
    assert(
      !apiLogs.includes(value),
      "Sensitive sentinel leaked in actual API log",
    );
  assert(!apiLogs.includes(csrfToken), "CSRF token leaked in actual API log");
  const vite = path.join(frontRoot, "node_modules/vite/bin/vite.js");
  const frontEnv = { ...process.env, BASE_PATH: "/" };
  await run([vite, "build"], frontEnv, frontRoot);
  await run([vite, "build", "--ssr", "src/entry-server.tsx", "--outDir", "dist/server"], frontEnv, frontRoot);

  const port = await freePort();
  const frontOrigin = `http://127.0.0.1:${port}`;
  const siteUrl = `https://127.0.0.1:${port}`;
  const { storefrontHandler } = await import(pathToFileURL(path.join(frontRoot, "dist/server/entry-server.js")).href);
  const template = await readFile(path.join(frontRoot, "dist/public/index.html"), "utf8");
  const handle = storefrontHandler({ apiOrigin: origin, siteUrl, indexable: true, template: async () => template });
  const frontend = createServer((req, res) => {
    void handle(req, res, () => res.writeHead(404).end()).catch(() => res.writeHead(500).end());
  });
  let pages = 0;
  frontend.listen(port, "127.0.0.1");
  await once(frontend, "listening");
  try {
    const get = (route: string) => fetch(frontOrigin + route, { redirect: "manual" });
    const sitemap = await get("/sitemap.xml");
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers.get("content-type") ?? "", /^application\/xml/);
    const paths = [...(await sitemap.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map(match => new URL(match[1]).pathname);
    assert(paths.includes("/journal/local-smoke"));
    for (const route of paths) {
      const response = await get(route);
      assert.equal(response.status, 200, route);
      assert.equal(response.headers.get("x-robots-tag"), null, route);
      assert((await response.text()).includes('<main'), route);
      pages++;
    }
    const article = await get("/journal/local-smoke");
    assert((await article.text()).includes("Isolated migration verification"));
    assert.equal((await get("/shop/")).headers.get("location"), "/shop");
    for (const route of ["/missing", "/products/nonexistent", "/journal/nonexistent"]) {
      assert.equal((await get(route)).status, 404, route);
    }
    assert.equal((await get("/admin")).headers.get("x-robots-tag"), "noindex,nofollow");
  } finally {
    frontend.closeAllConnections();
    await new Promise<void>(resolve => frontend.close(() => resolve()));
  }
  const report = {
    environment: "isolated local; no production services or data",
    postgres: "real PostgreSQL via embedded-postgres, UTF8",
    s3: "local S3rver over HTTP with AWS S3 SDK",
    migration: migration
      .trim()
      .split(/\r?\n/)
      .map((s) => JSON.parse(s)),
    builtApi: {
      health: 200,
      readiness: 200,
      products: products.length,
      articles: articles.length,
      adminUnauthorized: 401,
      csrfEnforced: true,
      forgedForwardedHeadersCannotEvadeLimit: true,
      malformedJson: 400,
      oversizedJson: 413,
      unsupportedContentType: 415,
      compressedBodiesRejected: 415,
      sensitiveLogSentinelsAbsent: true,
      uploadsAuthenticateBeforeBodyParsing: true,
    },
    frontend: {
      serverRendered: true,
      verifiedSitemapPages: pages,
    },
    legacyUpstreamStopped: true,
  };
  await writeFile(
    new URL("../../../docs/backend-deployment-smoke.json", import.meta.url),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (api && api.exitCode === null) {
    const ended = once(api, "exit");
    api.kill("SIGTERM");
    await ended;
  }
  if (legacy.listening) {
    legacy.closeAllConnections();
    await new Promise<void>((r) => legacy.close(() => r()));
  }
  await closeS3?.();
  await stopIsolatedPostgres(engine);
  if (
    path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) ||
    !path.basename(directory).startsWith("varsa-deployment-")
  )
    throw new Error("Unsafe cleanup target");
  await rm(directory, { recursive: true, force: true, maxRetries:10, retryDelay:100 });
}
