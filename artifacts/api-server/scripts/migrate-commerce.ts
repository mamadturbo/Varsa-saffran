import { readFile, readdir } from "node:fs/promises";
import { db, pool } from "@workspace/db";
import { drizzle } from "drizzle-orm/node-postgres";
import { createHash } from "node:crypto";
import { backfillCommerce } from "../src/modules/catalog/backfill";
import { initialState } from "../src/lib/management-store";
import { createManagementStore } from "../src/lib/management-store";
import { importLegacyArticles } from "../src/modules/content/service";
import { fileService, imageBytes } from "../src/modules/files/storage";
import { storeMediaTable, customerMediaTable } from "@workspace/db/schema";

// Does not load any .env implicitly. Operator must explicitly select a target.
if (process.env.MIGRATION_TARGET_ACK !== "isolated-or-approved")
  throw new Error(
    "Set MIGRATION_TARGET_ACK=isolated-or-approved and explicitly supply DATABASE_URL. Never run on production without approval.",
  );
try {
  const folder = new URL("../../../lib/db/migrations/", import.meta.url);
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('varsa-migrations'))");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of (await readdir(folder))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const source = await readFile(new URL(name, folder), "utf8"),
        hash = createHash("sha256").update(source).digest("hex");
      const existing = await client.query(
        "SELECT sha256 FROM schema_migrations WHERE version=$1",
        [name],
      );
      if (existing.rowCount) {
        if (existing.rows[0].sha256 !== hash)
          throw new Error("Migration checksum drift");
        continue;
      }
      await client.query(source);
      await client.query(
        "INSERT INTO schema_migrations(version,sha256) VALUES ($1,$2)",
        [name, hash],
      );
    }
    const migrationDb = drizzle(client) as unknown as typeof db;
    const report = await backfillCommerce(
      migrationDb,
      process.argv.includes("--seed-empty") ? initialState() : undefined,
    );
    console.log(JSON.stringify({ phase: "commerce", ...report }));
    if (process.argv.includes("--import-articles"))
      console.log(
        JSON.stringify({
          phase: "articles",
          ...(await importLegacyArticles(createManagementStore(migrationDb))),
        }),
      );
    if (process.argv.includes("--copy-files")) {
      let publicCount = 0,
        privateCount = 0;
      const service = fileService(migrationDb);
      for (const media of await migrationDb.select().from(storeMediaTable)) {
        await service.save(
          media.id,
          imageBytes(media.data, media.mime),
          media.mime,
        );
        publicCount++;
      }
      for (const media of await migrationDb.select().from(customerMediaTable)) {
        await service.save(
          media.id,
          imageBytes(media.data, media.mime),
          media.mime,
          media.customerId,
        );
        privateCount++;
      }
      console.log(
        JSON.stringify({
          phase: "files",
          publicCount,
          privateCount,
          verified: true,
          legacyPreserved: true,
        }),
      );
    }
  } finally {
    await client.query("ROLLBACK");
    await client.query(
      "SELECT pg_advisory_unlock(hashtext('varsa-migrations'))",
    );
    client.release();
  }
} catch {
  console.error(
    "Migration failed. Originals retained. Check isolated target and reconciliation.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
