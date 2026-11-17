import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL for the intended API database before migrating.');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const sql = await readFile(new URL('../migrations/0002_admin_login_limits.sql', import.meta.url), 'utf8');
  const connection = await pool.connect();
  try { await connection.query(sql); } finally { connection.release(); }
  console.log('Admin login limits migration applied.');
} catch (error) {
  console.error('Admin login limits migration failed.', error?.code ?? 'Check database connectivity and schema.');
  process.exitCode = 1;
} finally { await pool.end(); }
