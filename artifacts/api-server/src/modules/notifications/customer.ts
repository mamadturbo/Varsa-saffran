import { eq } from "drizzle-orm";
import {
  customerNotificationsTable,
  customersTable,
  outbox,
} from "@workspace/db/schema";
import type { Database } from "../catalog/repository";

export async function notifyCustomer(
  tx: Database,
  cid: string,
  title: string,
  message: string,
  orderId: number | null = null,
  smsEnabled = false,
) {
  const [owner] = await tx
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, cid));
  const profile = owner?.profile;
  const [notification] = await tx
    .insert(customerNotificationsTable)
    .values({
      customerId: cid,
      title,
      message,
      orderId,
      smsStatus: smsEnabled && profile?.smsUpdates ? "pending" : "disabled",
    })
    .returning();
  if (notification.smsStatus === "pending")
    await tx.insert(outbox).values({
      id: `sms:${notification.id}`,
      kind: "sms.notification",
      payload: { notificationId: notification.id },
    });
}
