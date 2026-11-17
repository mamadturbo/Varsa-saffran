import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { db } from "@workspace/db";
import {
  products,
  variants,
  inventory,
  coupons,
  contentEntries,
  storeConfig,
  orderDetails,
  movements,
} from "@workspace/db/schema";
import type {
  ManagedProduct,
  ManagementState,
  Coupon,
  ManagedArticle,
  Banner,
  StoreSettings,
  OrderMeta,
} from "@workspace/catalog";
import { StoreError } from "../../lib/management-store";

export type Database = typeof db;
export function weightMilligrams(weight: number, unit: string) {
  const multiplier = (
    {
      گرم: 1000,
      g: 1000,
      مثقال: 4608,
      mithqal: 4608,
      mg: 1,
      میلی‌گرم: 1,
      kg: 1000000,
      کیلوگرم: 1000000,
    } as Record<string, number>
  )[unit];
  const result = weight * multiplier;
  const rounded = Math.round(result);
  if (
    !multiplier ||
    !Number.isSafeInteger(rounded) ||
    rounded <= 0 ||
    rounded > 2147483647 ||
    Math.abs(result - rounded) > 1e-7
  )
    throw new StoreError("وزن باید با دقت میلی‌گرم و واحد شناخته‌شده باشد.");
  return rounded;
}
export async function readState(
  database: Database,
  includeOrders = true,
): Promise<ManagementState> {
  // One SQL snapshot for each aggregate; read a consistent complete state in the
  // caller's transaction when a business decision depends on more than one row.
  const [config] = await database
    .select()
    .from(storeConfig)
    .where(eq(storeConfig.id, "main"));
  if (!config)
    throw new StoreError("مهاجرت اطلاعات فروشگاه اجرا نشده است.", 503);
  const rows = await database
    .select()
    .from(variants)
    .innerJoin(inventory, eq(variants.id, inventory.variantId));
  const couponRows = await database.select().from(coupons);
  const entries = await database.select().from(contentEntries);
  const details = includeOrders
    ? await database.select().from(orderDetails)
    : [];
  return {
    revision: config.revision,
    settings: config.settings as unknown as StoreSettings,
    legacyArticlesEnabled: !config.articlesImported,
    products: rows
      .map(
        ({ product_variants: v, inventory: i }) =>
          ({
            ...v.display,
            id: v.id,
            slug: v.slug,
            name: v.name,
            price: v.price,
            active: v.active,
            stock: i.available,
            stockRevision: i.version,
          }) as unknown as ManagedProduct,
      )
      .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)),
    coupons: couponRows.map((c) => ({ ...c, limit: c.limit }) as Coupon),
    articles: config.articlesInitialized
      ? entries
          .filter((e) => e.kind === "article")
          .map((e) => e.payload as unknown as ManagedArticle)
      : null,
    banners: entries
      .filter((e) => e.kind === "banner")
      .map((e) => e.payload as unknown as Banner),
    orderMeta: Object.fromEntries(
      details.map((d) => [String(d.orderId), d.meta as unknown as OrderMeta]),
    ),
  };
}
export async function insertProduct(tx: Database, p: ManagedProduct) {
  // No business parent can safely be inferred from a legacy name or category.
  const parent = `legacy:${p.id}`;
  await tx
    .insert(products)
    .values({ id: parent, name: p.name, attributes: { category: p.category } })
    .onConflictDoNothing();
  await tx.insert(variants).values({
    id: p.id,
    productId: parent,
    sku: p.id,
    slug: p.slug,
    name: p.name,
    price: p.price,
    weightMg: weightMilligrams(p.weight, p.weight_unit),
    active: p.active,
    display: displayFields(p),
  });
  await tx.insert(inventory).values({ variantId: p.id, available: p.stock });
  if (p.stock !== null)
    await tx
      .insert(movements)
      .values({
        variantId: p.id,
        delta: p.stock,
        reason: "opening_balance",
        eventKey: `opening:${p.id}`,
      });
}
const changed = (a: unknown, b: unknown) =>
  JSON.stringify(a) !== JSON.stringify(b);
function displayFields(p: ManagedProduct) {
  const { id, slug, name, price, stock, active, stockRevision, ...display } = p;
  return display;
}
export async function persistStateChanges(
  tx: Database,
  before: ManagementState,
  after: ManagementState,
) {
  for (const p of [...after.products].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const old = before.products.find((v) => v.id === p.id);
    if (!old) {
      await insertProduct(tx, p);
      continue;
    }
    if (!changed(old, p)) continue;
    // Lock only the edited variant. All writers take variant before inventory.
    await tx
      .select({ id: variants.id })
      .from(variants)
      .where(eq(variants.id, p.id))
      .for("update");
    if (old.stock !== p.stock) {
      const updated = await tx
        .update(inventory)
        .set({ available: p.stock, version: sql`${inventory.version}+1` })
        .where(
          and(
            eq(inventory.variantId, p.id),
            eq(inventory.version, old.stockRevision ?? 0),
          ),
        )
        .returning();
      if (!updated.length)
        throw new StoreError(
          "موجودی تغییر کرده است؛ اطلاعات را تازه کنید.",
          409,
        );
      await tx.insert(movements).values({
        variantId: p.id,
        delta: (p.stock ?? 0) - (old.stock ?? 0),
        reason:
          p.stock === null
            ? "tracking_disabled"
            : old.stock === null
              ? "opening_balance"
              : "admin_adjustment",
        eventKey: `admin:${randomUUID()}`,
      });
    }
    await tx
      .update(variants)
      .set({
        slug: p.slug,
        name: p.name,
        price: p.price,
        weightMg: weightMilligrams(p.weight, p.weight_unit),
        active: p.active,
        display: displayFields(p),
      })
      .where(eq(variants.id, p.id));
  }
  for (const c of after.coupons) {
    const old = before.coupons.find((v) => v.id === c.id);
    if (!old) await tx.insert(coupons).values(c);
    else if (changed(old, c)) {
      // Usage belongs to checkout. An admin cannot overwrite a concurrent use.
      const { used: _used, ...edit } = c;
      await tx.update(coupons).set(edit).where(eq(coupons.id, c.id));
    }
  }
  for (const [kind, entries, previous] of [
    ["article", after.articles ?? [], before.articles ?? []],
    ["banner", after.banners, before.banners],
  ] as const) {
    for (const e of entries)
      if (
        changed(
          previous.find((v) => v.id === e.id),
          e,
        )
      ) {
        const row = {
          id: `${kind}:${e.id}`,
          kind,
          slug: "slug" in e ? e.slug : null,
          payload: e as unknown as Record<string, unknown>,
        };
        await tx
          .insert(contentEntries)
          .values(row)
          .onConflictDoUpdate({ target: contentEntries.id, set: row });
      }
  }
  for (const [id, meta] of Object.entries(after.orderMeta))
    if (changed(before.orderMeta[id], meta)) {
      await tx
        .update(orderDetails)
        .set({ meta: meta as unknown as Record<string, unknown> })
        .where(eq(orderDetails.orderId, Number(id)));
    }
  await tx
    .update(storeConfig)
    .set({
      revision: before.revision + 1,
      settings: after.settings as unknown as Record<string, unknown>,
      articlesImported: after.legacyArticlesEnabled === false,
      articlesInitialized: after.articles !== null,
    })
    .where(eq(storeConfig.id, "main"));
}
