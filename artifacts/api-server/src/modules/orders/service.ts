import { and, eq, inArray, sql } from "drizzle-orm";
import {
  ordersTable,
  customerContacts,
  variants,
  inventory,
  coupons,
  orderDetails,
  orderItems,
  reservations,
  movements,
  redemptions,
  customerOrderLinksTable,
  outbox,
  storeConfig,
} from "@workspace/db/schema";
import type { ManagementState, OrderMeta } from "@workspace/catalog";
import type { OrderToSave } from "../../lib/create-order";
import { StoreError, priceOrder } from "../../lib/management-store";
import type { Database } from "../catalog/repository";
import { normalizeIranMobile } from "@workspace/validation";
import { cardTransferConfig } from "../payments/config";
import { recordOrderEvent } from "./tracking";

export function reservationSeconds() {
  const seconds = Number(process.env.RESERVATION_TTL_SECONDS ?? 86400);
  if (!Number.isSafeInteger(seconds) || seconds < 60 || seconds > 2592000)
    throw new Error("Invalid RESERVATION_TTL_SECONDS");
  return seconds;
}
export async function lockLines(tx: Database, ids: string[]) {
  const sorted = [...new Set(ids)].sort();
  const rows = await tx
    .select()
    .from(variants)
    .where(inArray(variants.id, sorted))
    .orderBy(variants.id)
    .for("update");
  const stock = await tx
    .select()
    .from(inventory)
    .where(inArray(inventory.variantId, sorted))
    .orderBy(inventory.variantId)
    .for("update");
  return rows.map((v) => ({
    ...v.display,
    id: v.id,
    slug: v.slug,
    name: v.name,
    price: v.price,
    active: v.active,
    stock: stock.find((i) => i.variantId === v.id)?.available ?? null,
  }));
}
export async function saveOrder(database: Database, input: OrderToSave) {
  return database.transaction(async (raw) => {
    const tx = raw as unknown as Database;
    // Unique order insert arbitrates identical keys before touching inventory.
    const { couponCode, customerId, ...values } = input;
    const [order] = await tx
      .insert(ordersTable)
      .values(values)
      .onConflictDoNothing()
      .returning();
    if (!order) {
      const [existing] = await tx
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.idempotencyKey, input.idempotencyKey));
      if (!existing) throw new Error("Idempotent order unavailable");
      return existing;
    }
    const lines = await lockLines(
      tx,
      input.items.map((i) => i.productId),
    );
    if (lines.length !== input.items.length)
      throw new StoreError("محصول قابل سفارش نیست.", 409);
    const [config] = await tx
      .select()
      .from(storeConfig)
      .where(eq(storeConfig.id, "main"));
    let selected: (typeof coupons.$inferSelect)[] = [];
    if (couponCode)
      selected = await tx
        .select()
        .from(coupons)
        .where(eq(coupons.code, couponCode))
        .for("update");
    const state = {
      products: lines,
      coupons: selected,
      settings: config.settings,
    } as unknown as ManagementState;
    const pricing = priceOrder(state, input.items, couponCode);
    if (
      pricing.total !== input.total ||
      input.items.some(
        (i) => lines.find((p) => p.id === i.productId)?.price !== i.unitPrice,
      )
    )
      throw new StoreError("مبلغ سفارش تغییر کرده است.", 409);
    const stockItems: Record<string, number> = {};
    const snapshots: typeof order.items = [];
    for (const i of input.items) {
      const p = lines.find((p) => p.id === i.productId)!;
      const [v] = await tx
        .select()
        .from(variants)
        .where(eq(variants.id, i.productId));
      const snapshot = {
        ...i,
        name: v.name,
        imageUrl: String(v.display.image_url ?? i.imageUrl ?? ""),
        sku: v.sku,
        weightMg: v.weightMg,
        currency: "IRT",
        weight: v.display.weight,
        weightUnit: v.display.weight_unit,
      };
      snapshots.push(snapshot);
      await tx.insert(orderItems).values({
        orderId: order.id,
        variantId: v.id,
        snapshot,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      });
      if (p.stock !== null) {
        stockItems[v.id] = i.quantity;
        await tx
          .update(inventory)
          .set({
            available: sql`${inventory.available} - ${i.quantity}`,
            version: sql`${inventory.version}+1`,
          })
          .where(eq(inventory.variantId, v.id));
        await tx.insert(reservations).values({
          orderId: order.id,
          variantId: v.id,
          quantity: i.quantity,
          expiresAt: sql`now() + ${reservationSeconds()} * interval '1 second'`,
        });
        await tx.insert(movements).values({
          variantId: v.id,
          orderId: order.id,
          delta: -i.quantity,
          reason: "reserve",
          eventKey: `reserve:${order.id}:${v.id}`,
        });
      }
    }
    const mobile = normalizeIranMobile(input.phone);
    let customerContactId: string | undefined;
    if (mobile) {
      await tx.insert(customerContacts).values({ phone: mobile })
        .onConflictDoNothing({ target: customerContacts.phone });
      const [contact] = await tx.select({ id: customerContacts.id }).from(customerContacts)
        .where(eq(customerContacts.phone, mobile));
      customerContactId = contact.id;
    }
    await tx
      .update(ordersTable)
      .set({ items: snapshots, customerContactId })
      .where(eq(ordersTable.id, order.id));
    if (selected.length) {
      await tx
        .update(coupons)
        .set({ used: sql`${coupons.used}+1` })
        .where(eq(coupons.id, selected[0].id));
      await tx.insert(redemptions).values({
        orderId: order.id,
        couponId: selected[0].id,
        discount: pricing.discount,
      });
    }
    if (customerId)
      await tx
        .insert(customerOrderLinksTable)
        .values({ orderId: order.id, customerId });
    const meta = {
      ...pricing,
      trackingCode: "",
      reserved: true,
      inventoryTracked: true,
      stockItems,
    };
    await tx.insert(orderDetails).values({
      orderId: order.id,
      paymentMethod: pricing.shippingConfigured && cardTransferConfig().enabled ? "card_transfer" : "manual",
      meta,
      addressSnapshot: {
        name: input.customerName,
        phone: input.phone,
        address: input.address,
      },
    });
    await recordOrderEvent(tx, {
      orderId: order.id,
      kind: "order_created",
      actor: "system:checkout",
      eventKey: `created:${order.id}`,
      occurredAt: order.createdAt,
    });
    await tx.insert(outbox).values({
      id: `order-created:${order.id}`,
      kind: "order.created",
      payload: { orderId: order.id },
    });
    return { ...order, items: snapshots };
  });
}

export async function transitionInventory(
  tx: Database,
  order: typeof ordersTable.$inferSelect,
  status: string,
  meta: OrderMeta,
) {
  const rows = await tx
    .select()
    .from(reservations)
    .where(eq(reservations.orderId, order.id));
  const ids = rows.map((r) => r.variantId);
  if (!ids.length) return;
  await lockLines(tx, ids);
  if (status === "cancelled") {
    for (const r of rows.filter((r) => r.state === "reserved")) {
      await tx
        .update(inventory)
        .set({
          available: sql`${inventory.available}+${r.quantity}`,
          version: sql`${inventory.version}+1`,
        })
        .where(eq(inventory.variantId, r.variantId));
      await tx
        .update(reservations)
        .set({ state: "released" })
        .where(eq(reservations.id, r.id));
      await tx.insert(movements).values({
        variantId: r.variantId,
        orderId: order.id,
        delta: r.quantity,
        reason: "release",
        eventKey: `release:${r.id}:${r.generation}`,
      });
    }
    meta.reserved = false;
  } else if (order.status === "cancelled") {
    // Reopening is a fresh reservation of the same immutable order lines.
    const expiry = sql`now() + ${reservationSeconds()} * interval '1 second'`;
    const lines = await lockLines(tx, ids);
    for (const r of rows.filter((r) => r.state === "released")) {
      const p = lines.find((p) => p.id === r.variantId)!;
      if (!p.active || p.stock === null || (p.stock as number) < r.quantity)
        throw new StoreError("موجودی برای فعال‌کردن مجدد کافی نیست.", 409);
      await tx
        .update(inventory)
        .set({
          available: sql`${inventory.available}-${r.quantity}`,
          version: sql`${inventory.version}+1`,
        })
        .where(eq(inventory.variantId, r.variantId));
      await tx
        .update(reservations)
        .set({
          state: "reserved",
          expiresAt: expiry,
          generation: r.generation + 1,
        })
        .where(eq(reservations.id, r.id));
      await tx.insert(movements).values({
        variantId: r.variantId,
        orderId: order.id,
        delta: -r.quantity,
        reason: "reopen",
        eventKey: `reopen:${r.id}:${r.generation + 1}`,
      });
    }
    meta.reserved = true;
  }
  if (["confirmed", "processing", "shipped", "delivered"].includes(status)) {
    // Manual confirmation accepts the sale; only pending orders auto-expire.
    // Keep reservation state until shipment so pre-shipment cancellation releases.
    if (["shipped", "delivered"].includes(status)) {
      await tx
        .update(reservations)
        .set({ state: "committed" })
        .where(
          and(
            eq(reservations.orderId, order.id),
            eq(reservations.state, "reserved"),
          ),
        );
      meta.reserved = false;
    }
  }
}
