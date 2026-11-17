import { readFile } from 'node:fs/promises';
import pg from 'pg';
if(!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL for the intended API database.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{await pool.query(await readFile(new URL('../migrations/0004_customer_portal.sql',import.meta.url),'utf8'));console.log('Customer portal migration applied.');}
catch(error){console.error('Customer portal migration failed.',error?.code??'Check database connectivity.');process.exitCode=1;}finally{await pool.end();}
