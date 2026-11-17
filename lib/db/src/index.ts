import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const max = Number(process.env.PG_POOL_MAX ?? 10);
if (!Number.isInteger(max) || max < 1 || max > 100) throw new Error('Invalid PG_POOL_MAX');
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max,
  connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
  statement_timeout: 15000, application_name: process.env.PG_APPLICATION_NAME ?? 'varsa-api' });
pool.on('error', () => { console.error('Database pool connection failed'); });
export const db = drizzle(pool, { schema });

export * from "./schema";
