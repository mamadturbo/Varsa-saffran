import { sql } from "drizzle-orm";
import type { db } from "@workspace/db";
export async function verifyRuntimeRole(database: typeof db) {
  if (process.env.NODE_ENV !== "production") return;
  const r = await database.execute<{ unsafe: boolean }>(sql`SELECT (
  r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb
  OR has_schema_privilege(current_user,'public','CREATE')
  OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND pg_has_role(current_user,c.relowner,'MEMBER'))
 ) AS unsafe FROM pg_roles r WHERE r.rolname=current_user`);
  if (r.rows[0]?.unsafe !== false)
    throw new Error(
      "Production runtime database role has excessive privileges; use the dedicated runtime role",
    );
  await database.execute(sql`SELECT token_hash FROM admin_sessions LIMIT 0`);
}
