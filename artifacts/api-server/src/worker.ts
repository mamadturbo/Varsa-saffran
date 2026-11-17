import { setTimeout as delay } from "node:timers/promises";
import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { processOne, enqueueLegacySms } from "./modules/notifications/queue";
import { expireOne } from "./modules/inventory/expiry";
import { logger } from "./lib/logger";
import { validateProductionConfig } from './lib/http-security';
import { verifyRuntimeRole } from './lib/runtime-role';
import { pollBale } from './modules/payments/bale';
validateProductionConfig();
await verifyRuntimeRole(db);

let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    stopping = true;
  });
let lastCleanup = 0;
let lastBalePoll = 0;
try {
  await enqueueLegacySms(db);
  while (!stopping) {
    try {
      const worked = await processOne(db);
      await expireOne(db);
      if (Date.now() - lastBalePoll > 3000) {
        lastBalePoll = Date.now();
        await pollBale(db).catch(() => logger.error({ code: 'bale_poll_failed' }, 'Bale poll failed'));
      }
      if (Date.now() - lastCleanup > 3600000) {
        await db.execute(
          sql`DELETE FROM customer_sessions WHERE expires_at<now()`,
        );
        await db.execute(sql`DELETE FROM customer_otps WHERE expires_at<now()`);
        await db.execute(
          sql`DELETE FROM customer_rate_limits WHERE expires_at<now()`,
        );
        await db.execute(
          sql`DELETE FROM admin_login_attempts WHERE expires_at<now()`,
        );
        await db.execute(sql`DELETE FROM admin_sessions WHERE expires_at<now() OR last_seen<now()-interval '20 minutes'`);
        await db.execute(sql`DELETE FROM security_limits WHERE expires_at<now()-interval '1 day'`);
        lastCleanup = Date.now();
      }
      if (!worked) await delay(1000);
    } catch {
      logger.error(
        { code: "worker_iteration_failed" },
        "Worker iteration failed",
      );
      await delay(2000);
    }
  }
} finally {
  await pool.end();
}
