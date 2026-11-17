import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Request } from "express";
import type { db } from "@workspace/db";
import { clientNetwork } from "./admin-login-limit";
import { StoreError } from "./management-store";
export async function consumeSecurityLimit(
  database: typeof db,
  bucket: string,
  max: number,
  seconds: number,
) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET required");
  const key = createHmac("sha256", secret).update(bucket).digest("hex");
  const r = await database.execute(
    sql`INSERT INTO security_limits(bucket,attempts,expires_at) VALUES(${key},1,now()+${seconds}*interval '1 second') ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN security_limits.expires_at<=now() THEN 1 ELSE security_limits.attempts+1 END,expires_at=CASE WHEN security_limits.expires_at<=now() THEN EXCLUDED.expires_at ELSE security_limits.expires_at END WHERE security_limits.expires_at<=now() OR security_limits.attempts<${max} RETURNING bucket`,
  );
  if (!r.rows.length)
    throw new StoreError(
      "تعداد تلاش‌ها زیاد است. کمی بعد دوباره امتحان کنید.",
      429,
    );
}
export async function securityLimit(
  database: typeof db,
  req: Request,
  purpose: string,
  identity: string,
  max: number,
  seconds: number,
) {
  await consumeSecurityLimit(
    database,
    `${purpose}:global`,
    Math.max(max * 100, 1000),
    seconds,
  );
  await consumeSecurityLimit(
    database,
    `${purpose}:network:${clientNetwork(req.ip ?? req.socket.remoteAddress ?? "")}`,
    Math.max(60, max * 10),
    seconds,
  );
  await consumeSecurityLimit(
    database,
    `${purpose}:identity:${identity}`,
    max,
    seconds,
  );
}
