import { readState, persistStateChanges } from "./repository";
import { saveOrder } from "../orders/service";
import { eq } from "drizzle-orm";
import type { db } from "@workspace/db";
import { ordersTable, storeConfig } from "@workspace/db/schema";
import {
  getRestoredCatalog,
  type ManagementState,
  type OrderPricing,
} from "@workspace/catalog";
import type { OrderToSave } from "../../lib/create-order";

export class StoreError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const initialState = (): ManagementState => ({
  revision: 0,
  products: getRestoredCatalog(process.env.BASE_PATH ?? "/").map((p) => ({
    ...p,
    active: true,
    stock: null,
  })),
  articles: null,
  legacyArticlesEnabled: true,
  banners: [],
  coupons: [],
  orderMeta: {},
  settings: {
    phone: process.env.VITE_CONTACT_PHONE ?? "",
    email: process.env.VITE_CONTACT_EMAIL ?? "",
    address: process.env.VITE_CONTACT_ADDRESS ?? "",
    instagram: process.env.VITE_INSTAGRAM_URL ?? "",
    telegram: process.env.VITE_TELEGRAM_URL ?? "",
    shippingEnabled: false,
    shippingFee: 0,
    freeShippingAbove: 0,
    returnWindowDays: 7,
    transactionalSmsEnabled: false,
  },
});

export function priceOrder(
  state: ManagementState,
  items: Array<{ productId: string; quantity: number }>,
  code = "",
): OrderPricing {
  let subtotal = 0;
  for (const item of items) {
    const product = state.products.find((p) => p.id === item.productId);
    if (!product?.active)
      throw new StoreError("یکی از محصولات دیگر قابل سفارش نیست.", 409);
    if (product.stock !== null && product.stock < item.quantity)
      throw new StoreError(`موجودی «${product.name}» کافی نیست.`, 409);
    subtotal += product.price * item.quantity;
  }
  const couponCode = code.trim().toUpperCase();
  let discount = 0;
  if (couponCode) {
    const c = state.coupons.find((c) => c.code === couponCode);
    if (
      !c?.active ||
      (c.expiresAt && Date.parse(c.expiresAt) <= Date.now()) ||
      (c.limit > 0 && c.used >= c.limit)
    )
      throw new StoreError("کد تخفیف نامعتبر یا منقضی است.");
    if (subtotal < c.minimum)
      throw new StoreError("مبلغ سبد به حداقل خرید این کد تخفیف نرسیده است.");
    discount = Math.min(
      subtotal,
      c.kind === "percent" ? Math.floor((subtotal * c.value) / 100) : c.value,
    );
  }
  const s = state.settings;
  const shipping =
    s.shippingEnabled &&
    !(s.freeShippingAbove > 0 && subtotal - discount >= s.freeShippingAbove)
      ? s.shippingFee
      : 0;
  const total = subtotal - discount + shipping;
  if (!Number.isSafeInteger(total) || total < 0 || total > 2_147_483_647)
    throw new StoreError("مبلغ سفارش بیش از حد مجاز است.");
  return {
    subtotal,
    discount,
    shipping,
    total,
    couponCode,
    shippingConfigured: s.shippingEnabled,
  };
}

export function createManagementStore(database: typeof db) {
  const read = () => readState(database);
  const publicState = () => readState(database, false);
  const mutate = async <T>(
    operation: (state: ManagementState, tx: typeof database) => Promise<T>,
  ) =>
    database.transaction(async (raw) => {
      const tx = raw as unknown as typeof database;
      await tx
        .select()
        .from(storeConfig)
        .where(eq(storeConfig.id, "main"))
        .for("update");
      const state = await readState(tx);
      const before = structuredClone(state);
      const result = await operation(state, tx);
      await persistStateChanges(tx, before, state);
      return result;
    });
  const findByKey = async (key: string) => {
    const [row] = await database
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.idempotencyKey, key))
      .limit(1);
    return row ?? null;
  };
  const save = (input: OrderToSave) => saveOrder(database, input);
  return { read, publicState, mutate, save, findByKey };
}
export type ManagementStore = ReturnType<typeof createManagementStore>;
