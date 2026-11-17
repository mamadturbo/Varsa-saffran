import type { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { consumeSecurityLimit } from "./security-limit";
export async function reserveSms(
  database: typeof db,
  purpose: "otp" | "notification",
) {
  const hourly = Number(process.env.SMS_HOURLY_LIMIT ?? 200),
    daily = Number(process.env.SMS_DAILY_LIMIT ?? 1000);
  if (
    !Number.isInteger(hourly) ||
    hourly < 1 ||
    !Number.isInteger(daily) ||
    daily < 1
  )
    throw new Error("Invalid SMS budget");
  try {
    await consumeSecurityLimit(database, "sms:hour", hourly, 3600);
    await consumeSecurityLimit(database, "sms:day", daily, 86400);
  } catch (error) {
    await database.execute(
      sql`INSERT INTO security_audit(event) VALUES('sms_budget_exhausted')`,
    );
    console.warn("security_alert:sms_budget_exhausted");
    throw error;
  }
  await database.execute(
    sql`INSERT INTO security_audit(event) VALUES(${`sms_attempt:${purpose}`})`,
  );
}
