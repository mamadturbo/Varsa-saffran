import { eq } from "drizzle-orm";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  storeConfig,
  storeManagementTable,
  variants,
  inventory,
  coupons,
  contentEntries,
  ordersTable,
  orderDetails,
  orderItems,
  reservations,
  redemptions,
} from "@workspace/db/schema";
import type { ManagementState } from "@workspace/catalog";
import { insertProduct, readState, type Database } from "./repository";
import { backfillCustomerSupport } from "../customers/backfill";

// Explicit command only: runtime must never silently replace missing data.
export async function backfillCommerce(
  database: Database,
  emptySeed?: ManagementState,
) {
  return database.transaction(async (raw) => {
    const tx = raw as unknown as Database;
    const [done] = await tx
      .select()
      .from(storeConfig)
      .where(eq(storeConfig.id, "main"));
    if (done)
      return {
        alreadyMigrated: true,
        products: (await tx.select().from(variants)).length,
        ...(await backfillCustomerSupport(tx)),
      };
    const [legacy] = await tx
      .select()
      .from(storeManagementTable)
      .where(eq(storeManagementTable.id, "main"))
      .for("update");
    const state =
      (legacy?.payload as unknown as ManagementState | undefined) ?? emptySeed;
    if (!state)
      throw new Error(
        "No legacy document. Explicit seed required for an empty database.",
      );
    if (!legacy && (await tx.select().from(ordersTable).limit(1)).length)
      throw new Error(
        "Existing orders without a legacy catalog: explicit reconciliation is required; refusing empty seed.",
      );
    if ((await tx.select().from(variants).limit(1)).length)
      throw new Error("Partial catalog found; refusing to overwrite.");
    for (const p of state.products) await insertProduct(tx, p);
    for (const c of state.coupons) await tx.insert(coupons).values(c);
    for (const [kind, entries] of [
      ["article", state.articles ?? []],
      ["banner", state.banners],
    ] as const)
      for (const e of entries)
        await tx.insert(contentEntries).values({
          id: `${kind}:${e.id}`,
          kind,
          slug: "slug" in e ? e.slug : null,
          payload: e as unknown as Record<string, unknown>,
        });
    const orders = await tx.select().from(ordersTable);
    for (const o of orders) {
      const meta = state.orderMeta[String(o.id)] ?? {
        subtotal: o.total,
        total: o.total,
        discount: 0,
        shipping: 0,
        couponCode: "",
        shippingConfigured: false,
        trackingCode: "",
        reserved: false,
      };
      await tx.insert(orderDetails).values({
        orderId: o.id,
        meta: meta as unknown as Record<string, unknown>,
        addressSnapshot: {
          name: o.customerName,
          phone: o.phone,
          address: o.address,
        },
        fulfillmentStatus:
          o.status === "delivered"
            ? "delivered"
            : o.status === "shipped"
              ? "shipped"
              : "unfulfilled",
      });
      for (const item of o.items) {
        const p = state.products.find((p) => p.id === item.productId);
        const [v] = p
          ? await tx.select().from(variants).where(eq(variants.id, p.id))
          : [];
        await tx.insert(orderItems).values({
          orderId: o.id,
          variantId: item.productId,
          snapshot: {
            ...item,
            sku: v?.sku ?? item.productId,
            weightMg: null,
            currency: "IRT",
            legacyWeightUnknown: true,
          },
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        });
      }
      for (const [id, quantity] of Object.entries(meta.stockItems ?? {})) {
        if (!state.products.some((p) => p.id === id))
          throw new Error(`Reservation references missing variant ${id}`);
        await tx.insert(reservations).values({
          orderId: o.id,
          variantId: id,
          quantity,
          state: meta.reserved
            ? "reserved"
            : o.status === "cancelled"
              ? "released"
              : "committed",
          expiresAt: new Date(Date.now() + 86400000),
        });
      }
      const c = state.coupons.find((c) => c.code === meta.couponCode);
      if (c)
        await tx
          .insert(redemptions)
          .values({ orderId: o.id, couponId: c.id, discount: meta.discount });
    }
    await tx.insert(storeConfig).values({
      id: "main",
      revision: state.revision,
      settings: state.settings as unknown as Record<string, unknown>,
      articlesImported: state.legacyArticlesEnabled === false,
      articlesInitialized: state.articles !== null,
    });
    const actual = await readState(tx);
    for (const p of state.products) {
      const migrated = actual.products.find((v) => v.id === p.id);
      if (
        !migrated ||
        migrated.slug !== p.slug ||
        migrated.price !== p.price ||
        migrated.stock !== p.stock ||
        migrated.name !== p.name
      )
        throw new Error(`Catalog reconciliation failed: ${p.id}`);
      assert.deepEqual(
        Object.fromEntries(
          Object.keys(p).map((key) => [
            key,
            (migrated as unknown as Record<string, unknown>)[key],
          ]),
        ),
        p,
        "All legacy product fields must reconcile",
      );
    }
    assert.deepEqual(actual.settings, state.settings);
    for (const c of state.coupons)
      assert.deepEqual(
        actual.coupons.find((v) => v.id === c.id),
        c,
      );
    for (const a of state.articles ?? [])
      assert.deepEqual(
        actual.articles?.find((v) => v.id === a.id),
        a,
      );
    for (const b of state.banners)
      assert.deepEqual(
        actual.banners.find((v) => v.id === b.id),
        b,
      );
    for (const order of orders) {
      const lines = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
        .orderBy(orderItems.id);
      assert.deepEqual(
        lines.map((line) =>
          Object.fromEntries(
            Object.keys(order.items[lines.indexOf(line)]).map((key) => [
              key,
              line.snapshot[key],
            ]),
          ),
        ),
        order.items,
      );
      if (state.orderMeta[String(order.id)])
        assert.deepEqual(
          actual.orderMeta[String(order.id)],
          state.orderMeta[String(order.id)],
        );
    }
    if (
      actual.products.length !== state.products.length ||
      actual.coupons.length !== state.coupons.length ||
      Object.keys(actual.orderMeta).length !== orders.length
    )
      throw new Error("Count reconciliation failed");
    return {
      alreadyMigrated: false,
      products: actual.products.length,
      coupons: actual.coupons.length,
      orders: orders.length,
      orderTotal: orders.reduce((n, o) => n + o.total, 0),
      currency: "IRT",
      legacyPreserved: true,
      reconciled: true,
      sourceSha256: createHash("sha256")
        .update(JSON.stringify({ state, orders }))
        .digest("hex"),
      ...(await backfillCustomerSupport(tx)),
    };
  });
}
