import { randomUUID } from "node:crypto";
import { and, eq, sql, inArray } from "drizzle-orm";
import {
  outbox,
  customerNotificationsTable,
  customersTable,
  storeConfig,
} from "@workspace/db/schema";
import type { Database } from "../catalog/repository";
import { sendCustomerSms } from "../../lib/customer-auth";
import { reserveSms } from '../../lib/sms-budget';
import { sendApprovalToBale, sendReceiptToBale } from '../payments/bale';

export const MAX_ATTEMPTS = 6;
export async function enqueueLegacySms(tx: Database) {
  const rows = await tx
    .select()
    .from(customerNotificationsTable)
    .where(
      inArray(customerNotificationsTable.smsStatus, [
        "pending",
        "sending",
        "failed",
      ]),
    );
  for (const n of rows)
    await tx
      .insert(outbox)
      .values({
        id: `sms:${n.id}`,
        kind: "sms.notification",
        payload: { notificationId: n.id },
        status: n.smsStatus === "failed" ? "failed" : "pending",
      })
      .onConflictDoNothing();
}
export async function claimJob(database: Database, leaseMs = 60000) {
  return database.transaction(async (raw) => {
    const tx = raw as unknown as Database;
    // Expired leases return to the queue, but attempts remain bounded.
    await tx
      .update(outbox)
      .set({ status: "failed", lastError: "lease_expired" })
      .where(
        sql`${outbox.status}='processing' AND ${outbox.leaseUntil}<now() AND ${outbox.attempts}>=${MAX_ATTEMPTS}`,
      );
    const [row] = await tx
      .select()
      .from(outbox)
      .where(
        sql`(${outbox.status}='pending' AND ${outbox.availableAt}<=now()) OR (${outbox.status}='processing' AND ${outbox.leaseUntil}<now() AND ${outbox.attempts}<${MAX_ATTEMPTS})`,
      )
      .orderBy(outbox.availableAt, outbox.id)
      .for("update", { skipLocked: true })
      .limit(1);
    if (!row) return null;
    const [job] = await tx
      .update(outbox)
      .set({
        status: "processing",
        attempts: row.attempts + 1,
        leaseUntil: sql`now() + ${leaseMs} * interval '1 millisecond'`,
        leaseToken: randomUUID(),
      })
      .where(eq(outbox.id, row.id))
      .returning();
    return job;
  });
}
export async function finishJob(
  database: Database,
  job: typeof outbox.$inferSelect,
  errorCode?: string,
) {
  const failed = !!errorCode;
  const terminal = failed && job.attempts >= MAX_ATTEMPTS;
  const updated = await database
    .update(outbox)
    .set({
      status: failed ? (terminal ? "failed" : "pending") : "completed",
      leaseUntil: null,
      leaseToken: null,
      lastError: errorCode ?? null,
      availableAt: sql`now() + ${Math.min(3600000, 1000 * 2 ** job.attempts)} * interval '1 millisecond'`,
    })
    .where(
      and(
        eq(outbox.id, job.id),
        eq(outbox.status, "processing"),
        eq(outbox.leaseToken, job.leaseToken!),
      ),
    )
    .returning();
  return updated.length === 1;
}
export async function handleJob(
  database: Database,
  job: typeof outbox.$inferSelect,
  sender = sendCustomerSms,
) {
  if (job.kind === "order.created" || job.kind === "order.status") return;
  if (job.kind === "payment.reviewed") {
    const { action, actor, orderId } = job.payload;
    if (action === "approved" && typeof actor === "string" && actor.startsWith("bale:"))
      await sendApprovalToBale(database, Number(orderId));
    return;
  }
  if (job.kind === "bale.receipt") { await sendReceiptToBale(database, String(job.payload.receiptId)); return; }
  if (job.kind !== "sms.notification") throw new Error("unknown_job_kind");
  const id = Number(job.payload.notificationId);
  const [n] = await database
    .select()
    .from(customerNotificationsTable)
    .where(eq(customerNotificationsTable.id, id));
  if (!n || n.smsStatus === "sent" || n.smsStatus === "disabled") return;
  const [customer] = await database
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, n.customerId));
  const [config] = await database
    .select()
    .from(storeConfig)
    .where(eq(storeConfig.id, "main"));
  if (
    !customer?.profile.smsUpdates ||
    !config.settings.transactionalSmsEnabled
  ) {
    await database
      .update(customerNotificationsTable)
      .set({ smsStatus: "disabled" })
      .where(eq(customerNotificationsTable.id, id));
    return;
  }
  await database
    .update(customerNotificationsTable)
    .set({ smsStatus: "sending", smsAttemptAt: new Date() })
    .where(eq(customerNotificationsTable.id, id));
  await reserveSms(database,'notification');
  await sender(
    customer.phone,
    `${n.title}\nجزئیات را در حساب ورسا ببینید.`,
    undefined,
    `varsa-notification-${id}`,
  );
  await database
    .update(customerNotificationsTable)
    .set({ smsStatus: "sent" })
    .where(eq(customerNotificationsTable.id, id));
}
export async function processOne(database: Database, sender = sendCustomerSms) {
  const job = await claimJob(database);
  if (!job) return false;
  try {
    await handleJob(database, job, sender);
    await finishJob(database, job);
  } catch {
    const acknowledged = await finishJob(database, job, "delivery_failed");
    if (acknowledged && job.kind === "sms.notification")
      await database
        .update(customerNotificationsTable)
        .set({ smsStatus: job.attempts >= MAX_ATTEMPTS ? "failed" : "pending" })
        .where(
          eq(customerNotificationsTable.id, Number(job.payload.notificationId)),
        );
  }
  return true;
}
