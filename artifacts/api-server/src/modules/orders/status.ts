import { transitionInventory } from "./service";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { db } from "@workspace/db";
import {
  ordersTable,
  orderDetails,
  shipments,
  outbox,
  type OrderStatus,
} from "@workspace/db/schema";
import type { ManagementState } from "@workspace/catalog";
import { recordOrderEvent, shipmentView } from "./tracking";
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
  shipping: { carrier?: string; actor?: string } = {},
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
  const changed = current.status !== status;
  const isFulfillment = status === "shipped" || status === "delivered";
  const wasFulfilled = current.status === "shipped" || current.status === "delivered";
  const actor = shipping.actor ?? "system:order";
  if (wasFulfilled && (!isFulfillment || (current.status === "delivered" && status === "shipped")))
    throw new StoreError("تغییر وضعیت سفارش ارسال‌شده به مرحلهٔ قبلی ممکن نیست.", 409);
  if (
    changed && isFulfillment && !wasFulfilled &&
    details?.paymentMethod === "card_transfer" && details.paymentStatus !== "paid"
  ) {
    throw new StoreError("ابتدا واریز کارت‌به‌کارت را در بله تأیید کنید.", 409);
  }

  const [previousShipment] = await tx.select().from(shipments).where(eq(shipments.orderId, id));
  const previousTracking = previousShipment ? previousShipment.trackingCode : meta.trackingCode || null;
  const nextTracking = trackingCode === undefined ? previousTracking : trackingCode || null;
  const nextCarrier = shipping.carrier === undefined ? previousShipment?.carrier ?? null : shipping.carrier || null;
  const trackingChanged = nextTracking !== previousTracking || nextCarrier !== (previousShipment?.carrier ?? null);
  const now = new Date();
  const shippedAt = previousShipment?.shippedAt ?? (changed && status === "shipped" ? now : null);
  const deliveredAt = previousShipment?.deliveredAt ?? (changed && status === "delivered" ? now : null);

  if (changed || trackingChanged) {
    if (changed) await transitionInventory(tx, current, status, meta);
    meta.trackingCode = nextTracking ?? "";
    if (deliveredAt) meta.deliveredAt = deliveredAt.toISOString();
    await tx.update(orderDetails).set({
      meta: meta as unknown as Record<string, unknown>,
      fulfillmentStatus: isFulfillment ? status : "unfulfilled",
    }).where(eq(orderDetails.orderId, id));
  }

  let shipment = previousShipment;
  if (trackingChanged || (changed && isFulfillment)) {
    const values = { carrier: nextCarrier, trackingCode: nextTracking, shippedAt, deliveredAt };
    [shipment] = await tx.insert(shipments).values({ orderId: id, ...values })
      .onConflictDoUpdate({ target: shipments.orderId, set: values }).returning();
  }

  let updated = current;
  if (changed || trackingChanged) {
    [updated] = await tx.update(ordersTable).set({ status, updatedAt: now })
      .where(eq(ordersTable.id, id)).returning();
  }
  if (changed) {
    await recordOrderEvent(tx, {
      orderId: id, kind: "status_changed", value: status, actor, occurredAt: now,
    });
    await tx.insert(outbox).values({
      id: `order-status:${id}:${randomUUID()}`,
      kind: "order.status",
      payload: { orderId: id, status },
    });
  }
  if (trackingChanged) {
    await recordOrderEvent(tx, {
      orderId: id, kind: "shipment_updated", actor, occurredAt: now,
    });
  }
  if (onChange && (changed || trackingChanged)) await onChange(tx, updated, current.status);
  const { idempotencyKey: _k, requestFingerprint: _f, ...safe } = updated;
  return {
    ...safe,
    id: String(updated.id),
    management: meta,
    paymentStatus: details?.paymentStatus ?? "unpaid",
    shipment: shipmentView(shipment),
  };
}
