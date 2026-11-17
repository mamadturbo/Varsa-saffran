// Persistent, loopback-only development services. Never reads a deployment .env.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { parseEnv, promisify } from 'node:util';
import { once } from 'node:events';
import { createServer } from 'node:net';
import EmbeddedPostgres from 'embedded-postgres';
import S3rver from 's3rver';

if (process.env.NODE_ENV === 'production') throw new Error('Local development only');
// Fail before opening the persistent database if another API already owns 5000.
const apiPortCheck = createServer();
apiPortCheck.listen(5000, '127.0.0.1');
await once(apiPortCheck, 'listening');
await new Promise<void>(resolve => apiPortCheck.close(() => resolve()));
const apiRoot = path.resolve(import.meta.dirname, '..');
const root = path.resolve(apiRoot, '../..');
// Only the public legacy article reader settings may come from the storefront.
// Never load deployment credentials or allow its .env to override local services.
let storefrontEnv: Record<string, string> = {};
try { storefrontEnv = parseEnv(await readFile(path.join(root, 'artifacts/varsa-shop/.env'), 'utf8')); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const legacyArticleSource = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || storefrontEnv.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || storefrontEnv.VITE_SUPABASE_ANON_KEY || '',
};
const directory = path.join(root, '.local', 'development');
const dataDir = path.join(directory, 'postgres');
await mkdir(directory, { recursive: true });
const secretFile = path.join(directory, 'secrets.json');
let secrets: Record<string, string>;
try { secrets = JSON.parse(await readFile(secretFile, 'utf8')); }
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  secrets = Object.fromEntries(['database', 'session', 'customer', 'mfa'].map(k => [k, randomBytes(32).toString('hex')]));
  await writeFile(secretFile, JSON.stringify(secrets), { mode: 0o600, flag: 'wx' });
}
if (['database', 'session', 'customer', 'mfa'].some(k => !/^[a-f0-9]{64}$/.test(secrets[k] ?? ''))) throw new Error('Invalid local secrets file');
async function freePort() {
  const server = createServer(); server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No local port');
  await new Promise<void>(resolve => server.close(() => resolve()));
  return address.port;
}
const port = await freePort();
const engine = new EmbeddedPostgres({
  databaseDir: dataDir, port, user: 'varsa_local', password: secrets.database,
  persistent: true, initdbFlags: ['--encoding=UTF8'], postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {}, onError: () => {},
});
const objects = path.join(directory, 'objects');
await mkdir(objects, { recursive: true });
const s3 = new S3rver({ address: '127.0.0.1', port: 0, silent: true, directory: objects, configureBuckets: [{ name: 'varsa-local' }] });
let api: ChildProcess | undefined, s3Started = false, closing = false;
async function close(code = 0) {
  if (closing) return; closing = true;
  if (api && api.exitCode === null && api.signalCode === null) {
    const exited = once(api, 'exit'); api.kill(); await exited;
  }
  if (s3Started) await s3.close();
  const owner = engine as unknown as { process?: ChildProcess };
  const child = owner.process;
  if (child && child.exitCode === null && child.signalCode === null) {
    if (path.resolve(dataDir) !== path.join(root, '.local', 'development', 'postgres')) throw new Error('Invalid shutdown target');
    const ctl = path.join(path.dirname(child.spawnfile), process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl');
    await promisify(execFile)(ctl, ['stop', '-D', dataDir, '-m', 'fast', '-w', '-t', '10'], { windowsHide: true, timeout: 15000 });
  }
  owner.process = undefined;
  // Keep database, objects and signing keys across restarts.
  process.exit(code);
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => void close());
process.on('message', message => { if (message === 'shutdown') void close(); });
process.on('disconnect', () => void close());
try {
  let initialized = false;
  try { await access(path.join(dataDir, 'PG_VERSION')); initialized = true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (!initialized) await engine.initialise();
  await engine.start();
  const address = await s3.run(); s3Started = true;
  const env: NodeJS.ProcessEnv = {
    ...process.env, NODE_ENV: 'development', PORT: '5000', BIND_HOST: '127.0.0.1',
    DATABASE_URL: `postgresql://varsa_local:${secrets.database}@127.0.0.1:${port}/postgres`,
    SESSION_SECRET: secrets.session, CUSTOMER_AUTH_SECRET: secrets.customer, ADMIN_MFA_KEY: secrets.mfa,
    CUSTOMER_AUTH_DEV_OTP: 'true', ADMIN_AUTH_DEV_OTP: 'true', CUSTOMER_SMS_URL: '', CUSTOMER_SMS_TOKEN: '',
    ...legacyArticleSource,
    PUBLIC_ORIGIN: 'http://127.0.0.1:5173', ALLOWED_ORIGINS: 'http://127.0.0.1:5173',
    CUSTOMER_ALLOWED_ORIGINS: 'http://127.0.0.1:5173', TRUSTED_PROXY_IPS: '',
    S3_ENDPOINT: `http://127.0.0.1:${address.port}`, S3_REGION: 'us-east-1', S3_BUCKET: 'varsa-local',
    S3_ACCESS_KEY_ID: 'S3RVER', S3_SECRET_ACCESS_KEY: 'S3RVER',
    MIGRATION_TARGET_ACK: 'isolated-or-approved', LOG_LEVEL: 'warn', PG_POOL_MAX: '5',
  };
  const migration = spawn(process.execPath, ['dist/migrate-commerce.mjs', '--seed-empty'], { cwd: apiRoot, env, stdio: 'inherit', windowsHide: true });
  const [status] = await once(migration, 'exit');
  if (status !== 0) throw new Error('Local migration failed; data retained');
  api = spawn(process.execPath, ['--enable-source-maps', 'dist/index.mjs'], { cwd: apiRoot, env, stdio: 'inherit', windowsHide: true });
  api.once('error', () => void close(1));
  api.once('exit', code => { if (!closing) void close(code ?? 1); });
  console.log('Local API: http://127.0.0.1:5000 — development OTP only; data kept in .local/development');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Local startup failed');
  await close(1);
}
