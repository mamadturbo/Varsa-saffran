import { transitionInventory } from "./service";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { db } from "@workspace/db";
import {
  ordersTable,
  orderDetails,
  outbox,
  type OrderStatus,
} from "@workspace/db/schema";
import type { ManagementState } from "@workspace/catalog";
import { StoreError } from "../../lib/management-store";
export type OrderChangeHook = (
  tx: typeof db,
  order: typeof ordersTable.$inferSelect,
  previous: string,
) => Promise<void>;
export async function updateManagedOrder(
  state: ManagementState,
  tx: typeof db,
  id: number,
  status: OrderStatus,
  trackingCode?: string,
  onChange?: OrderChangeHook,
) {
  const [current] = await tx
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
    .for("update");
  if (!current) throw new StoreError("سفارش پیدا نشد.", 404);
  const [details] = await tx
    .select()
    .from(orderDetails)
    .where(eq(orderDetails.orderId, id));
  const meta = (details?.meta ?? {
    subtotal: current.total,
    total: current.total,
    discount: 0,
    shipping: 0,
    shippingConfigured: false,
    couponCode: "",
    trackingCode: "",
    reserved: false,
  }) as unknown as import("@workspace/catalog").OrderMeta;
  if (
    ["shipped", "delivered"].includes(current.status) &&
    status === "cancelled"
  )
    throw new StoreError("سفارش ارسال‌شده قابل لغو نیست.", 409);
  await transitionInventory(tx, current, status, meta);
  const previousTracking = meta.trackingCode;
  if (trackingCode !== undefined) meta.trackingCode = trackingCode;
  if (status === "delivered" && !meta.deliveredAt)
    meta.deliveredAt = (
      current.status === "delivered" ? current.updatedAt : new Date()
    ).toISOString();
  const [updated] = await tx
    .update(ordersTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(ordersTable.id, id))
    .returning();
  await tx
    .update(orderDetails)
    .set({
      meta: meta as unknown as Record<string, unknown>,
      fulfillmentStatus:
        status === "delivered"
          ? "delivered"
          : status === "shipped"
            ? "shipped"
            : "unfulfilled",
    })
    .where(eq(orderDetails.orderId, id));
  if (current.status !== status)
    await tx
      .insert(outbox)
      .values({
        id: `order-status:${id}:${randomUUID()}`,
        kind: "order.status",
        payload: { orderId: id, status },
      })
      .onConflictDoNothing();
  if (
    onChange &&
    (current.status !== status ||
      (trackingCode !== undefined && trackingCode !== previousTracking))
  )
    await onChange(tx, updated, current.status);
  const { idempotencyKey: _k, requestFingerprint: _f, ...safe } = updated;
  return { ...safe, id: String(updated.id), management: meta };
}
