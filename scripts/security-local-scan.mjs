import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
function localOrigin(value) {
  const u = new URL(value);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) ||
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.pathname !== "/" ||
    u.search ||
    u.hash
  )
    throw new Error("This scanner is restricted to explicit loopback origins");
  return u.origin;
}
const api = localOrigin(process.argv[2] ?? "http://127.0.0.1:5017"),
  front = localOrigin(process.argv[3] ?? "http://127.0.0.1:5187");
const results = [];
async function probe(name, path, status, init = {}) {
  const r = await fetch(api + path, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(r.status, status, name);
  const text = await r.text();
  assert(
    !/"stack"|"password_hash"|"token_hash"|postgresql:\/\//i.test(text),
    name + " internal data",
  );
  results.push({ name, status: r.status });
  return r;
}
await probe("Admin unauthorized", "/api/admin/management", 401);
await probe(
  "Forged bearer and forwarding headers",
  "/api/admin/management",
  401,
  {
    headers: {
      Authorization: "Bearer forged-token",
      "X-Forwarded-For": "198.51.100.1",
      "X-Real-IP": "192.0.2.1",
    },
  },
);
await probe(
  "Private file unauthenticated",
  "/api/customer/media/00000000-0000-4000-8000-000000000000",
  404,
);
await probe(
  "Public file path cannot disclose missing private object",
  "/api/media/00000000-0000-4000-8000-000000000000",
  404,
);
for (const path of [
  "/api/orders",
  "/api/admin/login",
  "/api/customer/auth/request",
  "/api/contact",
])
  await probe("Missing CSRF " + path, path, 403, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
const c = await fetch(api + "/api/csrf", { redirect: "error" }),
  token = (await c.json()).csrfToken;
await probe(
  "Foreign origin with a valid independent CSRF pair",
  "/api/admin/logout",
  403,
  {
    method: "POST",
    headers: {
      Origin: "https://attacker.invalid",
      "X-Varsa-CSRF": token,
      Cookie: c.headers.get("set-cookie").split(";")[0],
    },
  },
);
const cors = await fetch(api + "/api/admin/session", {
  method: "OPTIONS",
  headers: {
    Origin: "https://attacker.invalid",
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "X-Varsa-CSRF",
  },
  redirect: "error",
});
assert.equal(cors.headers.get("access-control-allow-origin"), null);
results.push({ name: "CORS rejects attacker origin", status: cors.status });
const marker = "security-probe-no-reflection";
const catalog = await fetch(
  api +
    "/api/store/products?x=" +
    encodeURIComponent("<script>" + marker + "</script>"),
  { redirect: "error" },
);
assert.equal(catalog.status, 200);
assert(!(await catalog.text()).includes(marker));
results.push({
  name: "Catalog query does not reflect script probe",
  status: 200,
});
for (const path of ["/", "/admin", "/contact", "/products/super-negin-1g"]) {
  const r = await fetch(front + path, { redirect: "error" });
  assert.equal(r.status, 200);
  const csp = r.headers.get("content-security-policy");
  assert(csp?.includes("script-src 'self'"));
  assert(!/script-src[^;]*unsafe/.test(csp));
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("strict-transport-security"), null);
  results.push({ name: "Frontend headers " + path, status: r.status });
}
const report = {
  date: new Date().toISOString(),
  scope:
    "Disposable loopback environment only; no third party or public active scans",
  api,
  front,
  checks: results.length,
  results,
  zap: "Not available: no installed ZAP, Java or Docker. These bounded HTTP probes complement regression tests; no ZAP coverage claimed.",
};
await writeFile(
  new URL("../docs/security/local-scan.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    checks: results.length,
    passed: true,
    scope: "loopback only",
  }),
);
