import { randomUUID, timingSafeEqual } from "node:crypto";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import type { ManagementState } from "@workspace/catalog";
import {
  cardTransferReceipts as receipts,
  ordersTable,
  orderDetails,
  reservations,
  outbox,
  customerOrderLinksTable,
  customerNotificationsTable,
} from "@workspace/db/schema";
import type { Database } from "../catalog/repository";
import {
  digest,
  encodeUpload,
  s3Storage,
  type ObjectStorage,
} from "../files/storage";
import { StoreError } from "../../lib/management-store";
import { updateManagedOrder, type OrderChangeHook } from "../orders/status";
import { cardTransferConfig } from "./config";

export function matchesOrderKey(actual: string | null, supplied?: string) {
  return (
    !!actual &&
    !!supplied &&
    /^[a-f0-9-]{36}$/.test(supplied) &&
    actual.length === supplied.length &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(supplied))
  );
}
export async function latestReceipt(db: Database, orderId: number) {
  const [receipt] = await db
    .select()
    .from(receipts)
    .where(eq(receipts.orderId, orderId))
    .orderBy(desc(receipts.createdAt), desc(receipts.id))
    .limit(1);
  return receipt;
}
export async function submitReceipt(
  db: Database,
  orderId: number,
  data: string,
  mime: string,
  suppliedStorage?: ObjectStorage,
) {
  const config = cardTransferConfig();
  if (!config.enabled)
    throw new StoreError(
      "پرداخت کارت‌به‌کارت هنوز فعال نشده است؛ فعلاً واریز نکنید.",
      409,
    );
  const image = await encodeUpload(data, mime);
  return db.transaction(async (raw) => {
    const tx = raw as unknown as Database;
    const [order] = await tx
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .for("update");
    const [details] = await tx
      .select()
      .from(orderDetails)
      .where(eq(orderDetails.orderId, orderId));
    if (
      !order ||
      order.status !== "pending" ||
      !details ||
      details.paymentStatus !== "unpaid"
    )
      throw new StoreError(
        "این سفارش قابل پرداخت نیست. وضعیت سفارش را بررسی کنید.",
        409,
      );
    if (!details.meta.shippingConfigured)
      throw new StoreError(
        "هزینه ارسال هنوز تعیین نشده است؛ پیش از واریز با فروشگاه هماهنگ کنید.",
        409,
      );
    const previous = await latestReceipt(tx, orderId);
    if (previous?.status === "pending" || previous?.status === "approved")
      return previous;
    const all = await tx
      .select({ id: receipts.id })
      .from(receipts)
      .where(eq(receipts.orderId, orderId));
    if (all.length >= 5)
      throw new StoreError("برای بررسی پرداخت با پشتیبانی تماس بگیرید.", 409);
    const hash = digest(image.bytes);
    // All receipt uploads use the same quota lock, including duplicate checks.
    await tx.execute(
      sql`SELECT id FROM security_storage_lock WHERE id=1 FOR UPDATE`,
    );
    const [duplicate] = await tx
      .select()
      .from(receipts)
      .where(and(eq(receipts.sha256, hash), ne(receipts.orderId, orderId)))
      .limit(1);
    if (duplicate)
      throw new StoreError("این تصویر برای سفارش دیگری ارسال شده است.", 409);
    const cap = Number(process.env.UPLOAD_TOTAL_BYTES ?? 10737418240);
    const usage = (
      await tx.execute<{ total: string }>(
        sql`SELECT ((SELECT COALESCE(SUM(size),0) FROM stored_files)+(SELECT COALESCE(SUM(size),0) FROM card_transfer_receipts))::text AS total`,
      )
    ).rows[0];
    if (!Number.isSafeInteger(cap) || cap < 1)
      throw new Error("Invalid upload quota");
    if (Number(usage.total) + image.bytes.length > cap)
      throw new StoreError(
        "فضای دریافت رسید تکمیل شده است؛ با پشتیبانی تماس بگیرید.",
        413,
      );
    const id = randomUUID(),
      objectKey = `private/${id}/${hash}`;
    const storage = suppliedStorage ?? s3Storage();
    await storage.put(objectKey, image.bytes, image.mime);
    if (digest(await storage.get(objectKey)) !== hash)
      throw new Error("Receipt checksum mismatch");
    const [receipt] = await tx
      .insert(receipts)
      .values({
        id,
        orderId,
        objectKey,
        sha256: hash,
        size: image.bytes.length,
        amount: order.total,
        destination: {
          cardNumber: config.cardNumber,
          accountName: config.accountName,
          bankName: config.bankName,
        },
      })
      .returning();
    await tx
      .update(orderDetails)
      .set({ paymentMethod: "card_transfer" })
      .where(eq(orderDetails.orderId, orderId));
    await tx
      .insert(outbox)
      .values({
        id: `bale-receipt:${id}`,
        kind: "bale.receipt",
        payload: { receiptId: id },
      });
    return receipt;
  });
}

// The caller owns the transaction. Lock the order before the receipt, consistently
// with uploads, expiry and admin status changes. Replays have no side effects.
export async function reviewReceipt(
  tx: Database,
  id: string,
  action: "approved" | "rejected",
  actor: string,
  onChange?: OrderChangeHook,
) {
  const [found] = await tx.select().from(receipts).where(eq(receipts.id, id));
  if (!found) throw new StoreError("رسید پیدا نشد.", 404);
  const [order] = await tx
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, found.orderId))
    .for("update");
  const [receipt] = await tx
    .select()
    .from(receipts)
    .where(eq(receipts.id, id))
    .for("update");
  if (receipt.status !== "pending") return receipt.status;
  const [details] = await tx
    .select()
    .from(orderDetails)
    .where(eq(orderDetails.orderId, found.orderId));
  if (
    !order ||
    !["pending", "confirmed"].includes(order.status) ||
    details?.paymentStatus !== "unpaid" ||
    order.total !== receipt.amount
  )
    throw new StoreError(
      "وضعیت سفارش تغییر کرده است؛ از پنل مدیریت بررسی کنید.",
      409,
    );
  if (action === "approved") {
    await tx
      .update(orderDetails)
      .set({ paymentStatus: "paid" })
      .where(eq(orderDetails.orderId, order.id));
    await updateManagedOrder(
      {} as ManagementState,
      tx,
      order.id,
      "confirmed",
      undefined,
      onChange,
    );
  } else {
    await tx
      .update(reservations)
      .set({ expiresAt: sql`now()+interval '24 hours'` })
      .where(
        and(
          eq(reservations.orderId, order.id),
          eq(reservations.state, "reserved"),
        ),
      );
  }
  await tx
    .update(receipts)
    .set({ status: action, reviewedBy: actor, reviewedAt: new Date() })
    .where(eq(receipts.id, id));
  const [link] = await tx
    .select()
    .from(customerOrderLinksTable)
    .where(eq(customerOrderLinksTable.orderId, order.id));
  if (link)
    await tx
      .insert(customerNotificationsTable)
      .values({
        customerId: link.customerId,
        orderId: order.id,
        title:
          action === "approved"
            ? "پرداخت و سفارش تأیید شد"
            : "رسید پرداخت تأیید نشد",
        message:
          action === "approved"
            ? `پرداخت سفارش ${order.orderNumber} بررسی و تأیید شد.`
            : `رسید سفارش ${order.orderNumber} تأیید نشد؛ رسید صحیح را ارسال کنید یا با فروشگاه تماس بگیرید.`,
        smsStatus: "disabled",
      });
  await tx
    .insert(outbox)
    .values({
      id: `receipt-reviewed:${id}`,
      kind: "payment.reviewed",
      payload: { receiptId: id, orderId: order.id, action, actor },
    });
  return action;
}
