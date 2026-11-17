// Isolated browser validation: fresh loopback PostgreSQL + S3 emulator + built API.
// No .env files are loaded; no production URL is used.
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import EmbeddedPostgres from "embedded-postgres";
import {
  migrateTest,
  seedTest,
  localS3,
  stopIsolatedPostgres,
} from "../test/commerce-fixture";
import { createManagementStore } from "../src/lib/management-store";
async function freePort() {
  const s = createServer();
  s.listen(0, "127.0.0.1");
  await once(s, "listening");
  const a = s.address();
  if (!a || typeof a === "string") throw new Error("port");
  await new Promise<void>((r) => s.close(() => r()));
  return a.port;
}
const root = path.resolve(import.meta.dirname, "../../.."),
  apiRoot = path.join(root, "artifacts/api-server");
const directory = await mkdtemp(path.join(tmpdir(), "varsa-security-browser-")),
  port = await freePort(),
  dbPassword = randomUUID();
const engine = new EmbeddedPostgres({
  databaseDir: path.join(directory, "data"),
  port,
  user: "security_test",
  password: dbPassword,
  persistent: true,
  initdbFlags: ["--encoding=UTF8"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
let pool: pg.Pool | undefined,
  closeS3: (() => Promise<void>) | undefined,
  api: ReturnType<typeof spawn> | undefined;
async function command(args: string[], env: NodeJS.ProcessEnv) {
  const c = spawn(process.execPath, args, {
    cwd: apiRoot,
    env,
    windowsHide: true,
    stdio: "pipe",
  });
  let output = "";
  c.stdout.on("data", (d) => {
    output += d;
  });
  c.stderr.on("data", (d) => {
    output += d;
  });
  const [exit] = await once(c, "exit");
  if (exit !== 0) throw new Error("Isolated CLI verification failed");
}
let stopping = false;
async function close() {
  if (stopping) return;
  stopping = true;
  api?.kill();
  await pool?.end();
  await closeS3?.();
  await stopIsolatedPostgres(engine);
  if (
    path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) ||
    !path.basename(directory).startsWith("varsa-security-browser-")
  )
    throw new Error("Unsafe cleanup");
  await rm(directory, { recursive: true, force: true, maxRetries:10, retryDelay:100 });
  process.exit(0);
}
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => void close());
try {
  await engine.initialise();
  await engine.start();
  closeS3 = await localS3();
  const databaseUrl = `postgresql://security_test:${dbPassword}@127.0.0.1:${port}/postgres`;
  pool = new pg.Pool({ connectionString: databaseUrl });
  const database = drizzle(pool) as unknown as Parameters<
    typeof createManagementStore
  >[0];
  await migrateTest({ exec: (s) => pool!.query(s) });
  await seedTest(database);
  await createManagementStore(database).mutate(async (state) => {
    state.articles = [];
    state.legacyArticlesEnabled = false;
    state.products.forEach((p) => {
      p.stock = 20;
    });
  });
  const password = "local-security-browser-password",
    passwordFile = path.join(directory, "password.txt");
  await writeFile(passwordFile, password, { mode: 0o600 });
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    NODE_ENV: "test",
    PORT: "5017",
    BIND_HOST: "127.0.0.1",
    SESSION_SECRET: randomBytes(32).toString("hex"),
    CUSTOMER_AUTH_SECRET: randomBytes(32).toString("hex"),
    ADMIN_MFA_KEY: randomBytes(32).toString("hex"),
    CUSTOMER_AUTH_DEV_OTP: "true",
    PUBLIC_ORIGIN: "http://127.0.0.1:5187",
    ALLOWED_ORIGINS: "http://127.0.0.1:5187",
    CUSTOMER_ALLOWED_ORIGINS: "http://127.0.0.1:5187",
    TRUSTED_PROXY_IPS: "",
    LOG_LEVEL: "fatal",
    ADMIN_OPERATOR_ACK: "explicit-target-approved",
    ADMIN_PASSWORD_FILE: passwordFile,
  };
  await command(["dist/admin-account.mjs", "create", "browser-admin"], env);
  await command(["dist/admin-account.mjs", "create", "recovery-operator"], env);
  const oldPasswordHash = (
    await pool.query(
      "SELECT password_hash FROM admin_accounts WHERE username='recovery-operator'",
    )
  ).rows[0].password_hash;
  await pool.query(
    "UPDATE admin_accounts SET totp_secret='fixture-encrypted-state',pending_secret='fixture-pending',pending_until=now()+interval '5 minutes',recovery_hashes='[\"fixture-hash\"]',last_counter=123 WHERE username='recovery-operator'",
  );
  await pool.query(
    "INSERT INTO admin_sessions(token_hash,admin_id,complete,expires_at) SELECT 'test-revoked',id,true,now()+interval '1 hour' FROM admin_accounts WHERE username='recovery-operator'",
  );
  await command(["dist/admin-account.mjs", "reset", "recovery-operator"], env);
  const revoked =
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM admin_sessions WHERE token_hash='test-revoked'",
      )
    ).rows[0].n === 0;
  if (!revoked) throw new Error("Operator recovery failed to revoke sessions");
  const reset = (
    await pool.query(
      "SELECT password_hash,totp_secret,pending_secret,pending_until,recovery_hashes,last_counter FROM admin_accounts WHERE username='recovery-operator'",
    )
  ).rows[0];
  const resetVerified =
    reset.password_hash !== oldPasswordHash &&
    reset.totp_secret === null &&
    reset.pending_secret === null &&
    reset.pending_until === null &&
    reset.recovery_hashes.length === 0 &&
    Number(reset.last_counter) === -1;
  if (!resetVerified)
    throw new Error("Operator recovery did not clear old factors");
  if (process.argv.includes("--verify-cli-only")) {
    await writeFile(
      path.join(root, "docs/security/operator-verification.json"),
      JSON.stringify(
        {
          environment: "fresh loopback PostgreSQL only",
          builtCli: true,
          accountCreated: true,
          recoveryRevokedSessions: revoked,
          recoveryResetFactorsAndPassword: true,
          publicCreationEndpoint: false,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Built admin account create/reset verified on isolated PostgreSQL.",
    );
    await close();
  }
  await writeFile(
    path.join(root, ".local/security-browser-fixture.json"),
    JSON.stringify({
      username: "browser-admin",
      password,
      origin: "http://127.0.0.1:5187",
      operatorCreateTested: true,
      operatorRecoveryRevokedSessions: revoked,
    }),
  );
  api = spawn(process.execPath, ["dist/index.mjs"], {
    cwd: apiRoot,
    env,
    windowsHide: true,
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5017/api/readyz")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!(await fetch("http://127.0.0.1:5017/api/readyz")).ok)
    throw new Error("API not ready");
  console.log(
    "Isolated security browser API ready on 127.0.0.1:5017; operator create/reset passed. No production data used.",
  );
  await new Promise(() => {});
} catch {
  console.error("Isolated security browser environment failed");
  await close();
}
