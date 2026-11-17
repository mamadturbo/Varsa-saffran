import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import S3rver from "s3rver";
import { backfillCommerce } from "../src/modules/catalog/backfill";
import { initialState } from "../src/lib/management-store";
import type EmbeddedPostgres from "embedded-postgres";
import { execFile, type ChildProcess } from "node:child_process";
import { promisify } from 'node:util';

// embedded-postgres 18.4.0-beta.17 waits unboundedly for a new exit event in
// stop(), even when the owned child has already exited. On Windows its external
// taskkill can race with exit hooks. Use the bundled pg_ctl for a bounded,
// graceful shutdown, restricted to our disposable temp directory and child.
export async function stopIsolatedPostgres(engine: EmbeddedPostgres) {
  const owner = engine as unknown as { process?: ChildProcess;options:{databaseDir:string} };
  const child = owner.process;
  if (!child) return;
  const dataDir=path.resolve(owner.options.databaseDir),root=path.dirname(dataDir);
  if(path.dirname(root)!==path.resolve(tmpdir()) || !/^varsa-(pg-|deployment-|security-browser-)/.test(path.basename(root)) || path.basename(dataDir)!=='data')throw new Error('Unsafe isolated database shutdown target');
  if(child.exitCode===null && child.signalCode===null){
    const pgCtl=path.join(path.dirname(child.spawnfile),process.platform==='win32'?'pg_ctl.exe':'pg_ctl');
    await promisify(execFile)(pgCtl,['stop','-D',dataDir,'-m','fast','-w','-t','10'],{windowsHide:true,timeout:15000});
  }
  owner.process = undefined;
}

export async function migrateTest(pg: {
  exec: (sql: string) => Promise<unknown>;
}) {
  const folder = new URL("../../../lib/db/migrations/", import.meta.url);
  for (const name of (await readdir(folder))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(new URL(name, folder), "utf8"));
}
export async function seedTest(
  database: Parameters<typeof backfillCommerce>[0],
) {
  return backfillCommerce(database, initialState());
}
export async function localS3() {
  const directory = await mkdtemp(path.join(tmpdir(), "varsa-s3-"));
  const s3 = new S3rver({
    address: "127.0.0.1",
    port: 0,
    silent: true,
    directory,
    configureBuckets: [{ name: "varsa-test" }],
  });
  const address = await s3.run();
  const old = Object.fromEntries(
    [
      "S3_ENDPOINT",
      "S3_BUCKET",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
    ].map((k) => [k, process.env[k]]),
  );
  Object.assign(process.env, {
    S3_ENDPOINT: `http://127.0.0.1:${address.port}`,
    S3_BUCKET: "varsa-test",
    S3_ACCESS_KEY_ID: "S3RVER",
    S3_SECRET_ACCESS_KEY: "S3RVER",
  });
  return async () => {
    await s3.close();
    if (
      path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) ||
      !path.basename(directory).startsWith("varsa-s3-")
    )
      throw new Error("Unsafe cleanup target");
    await rm(directory, { recursive: true, force: true });
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}
