import { asc, desc, eq } from "drizzle-orm";
import {
  cardTransferReceipts,
  orderDetails,
  orderEvents,
  ordersTable,
  shipments,
} from "@workspace/db/schema";
import type { Database } from "../catalog/repository";

export async function recordOrderEvent(
  tx: Database,
  event: typeof orderEvents.$inferInsert,
) {
  await tx.insert(orderEvents).values(event).onConflictDoNothing({
    target: orderEvents.eventKey,
  });
}

export function shipmentView(
  row: typeof shipments.$inferSelect | null | undefined,
) {
  if (!row) return null;
  const { carrier, trackingCode, shippedAt, deliveredAt } = row;
  return { carrier, trackingCode, shippedAt, deliveredAt };
}

export async function readOrderTracking(
  db: Database,
  orderId: number,
  admin = false,
) {
  const [[order], [receipt], events] = await Promise.all([
    db
      .select({
        status: ordersTable.status,
        paymentStatus: orderDetails.paymentStatus,
        fulfillmentStatus: orderDetails.fulfillmentStatus,
        shipment: shipments,
      })
      .from(ordersTable)
      .leftJoin(orderDetails, eq(ordersTable.id, orderDetails.orderId))
      .leftJoin(shipments, eq(ordersTable.id, shipments.orderId))
      .where(eq(ordersTable.id, orderId)),
    db
      .select({ status: cardTransferReceipts.status })
      .from(cardTransferReceipts)
      .where(eq(cardTransferReceipts.orderId, orderId))
      .orderBy(
        desc(cardTransferReceipts.createdAt),
        desc(cardTransferReceipts.id),
      )
      .limit(1),
    db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, orderId))
      .orderBy(asc(orderEvents.occurredAt), asc(orderEvents.id)),
  ]);
  if (!order) return null;
  return {
    status: order.status,
    paymentStatus: order.paymentStatus ?? "unpaid",
    fulfillmentStatus: order.fulfillmentStatus ?? "unfulfilled",
    receiptStatus: receipt?.status ?? null,
    shipment: shipmentView(order.shipment),
    events: events.map(({ id, kind, value, occurredAt, actor }) => ({
      id,
      kind,
      value,
      occurredAt,
      ...(admin ? { actor } : {}),
    })),
  };
}
