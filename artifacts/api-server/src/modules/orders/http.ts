import { createHash, randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import type { NewOrder, Order, OrderItem } from "@workspace/db/schema";
import {
  CatalogUnavailableError,
  resolveCatalogProduct,
  type CatalogProduct,
} from "@workspace/catalog";
import {
  normalizeIranMobile,
  MOBILE_PHONE_ERROR,
  MAX_PRODUCT_QUANTITY,
  MAX_ORDER_LINES,
  isOrderQuantity,
} from "@workspace/validation";
import { StoreError } from "../../lib/management-store";

export type OrderToSave = Pick<
  NewOrder,
  | "orderNumber"
  | "customerName"
  | "phone"
  | "address"
  | "items"
  | "total"
  | "status"
> & {
  idempotencyKey: string;
  requestFingerprint: string;
  couponCode?: string;
  customerId?: string;
};
type SavedOrder = Pick<
  Order,
  "id" | "orderNumber" | "status" | "total" | "createdAt" | "requestFingerprint"
>;
type SaveOrder = (order: OrderToSave) => Promise<SavedOrder>;

class InvalidOrderError extends Error {}
class PriceChangedError extends Error {}
class IdempotencyConflictError extends Error {}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > maxLength
  ) {
    throw new InvalidOrderError(`${field} is invalid`);
  }
  return value.trim();
}

async function resolveOrderItems(
  value: unknown,
  loadProducts: () => Promise<readonly CatalogProduct[]>,
): Promise<OrderItem[]> {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_ORDER_LINES
  ) {
    throw new InvalidOrderError("items are required");
  }

  const requested = value.map((rawItem) => {
    const item = asRecord(rawItem);
    if (!item) throw new InvalidOrderError("item is invalid");
    const productId = requiredString(item.productId, "productId", 100);
    const quantity = item.quantity;
    if (!isOrderQuantity(quantity)) {
      throw new InvalidOrderError("quantity is invalid");
    }

    return { productId, quantity };
  });
  const products = await loadProducts();
  const resolved = new Map<string, OrderItem>();
  for (const { productId, quantity } of requested) {
    const product = resolveCatalogProduct(products, productId);
    if (!product)
      throw new InvalidOrderError(
        "محصول انتخاب‌شده موجود نیست. لطفاً سبد خرید را به‌روز کنید.",
      );
    const combinedQuantity =
      (resolved.get(product.id)?.quantity ?? 0) + quantity;
    if (combinedQuantity > MAX_PRODUCT_QUANTITY) {
      throw new InvalidOrderError(
        `حداکثر تعداد هر محصول در سفارش ${MAX_PRODUCT_QUANTITY} عدد است.`,
      );
    }
    // Resolve aliases before combining so duplicate lines cannot bypass the cap.
    resolved.set(product.id, {
      productId: product.id,
      name: product.name,
      quantity: combinedQuantity,
      unitPrice: product.price,
      imageUrl: product.image_url,
    });
  }
  return [...resolved.values()];
}

export function createOrderHandler(
  saveOrder: SaveOrder,
  loadProducts: () => Promise<readonly CatalogProduct[]>,
  findExisting: (key: string) => Promise<SavedOrder | null>,
  quote?: (items: OrderItem[], code: string) => Promise<number>,
  identity?: (
    req: import("express").Request,
    phone: string,
  ) => Promise<string | undefined>,
): RequestHandler {
  return async (req, res) => {
    let replay: (() => Promise<boolean>) | undefined;
    try {
      const body = asRecord(req.body);
      if (!body) throw new InvalidOrderError("اطلاعات سفارش نامعتبر است.");
      const customerName = requiredString(
        body.customerName,
        "customerName",
        120,
      );
      const phone = normalizeIranMobile(body.phone);
      if (!phone) throw new InvalidOrderError(MOBILE_PHONE_ERROR);
      const address = requiredString(body.address, "address", 1000);
      const customerId = identity ? await identity(req, phone) : undefined;
      const idempotencyKey = requiredString(
        body.idempotencyKey,
        "idempotencyKey",
        36,
      ).toLowerCase();
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          idempotencyKey,
        )
      ) {
        throw new InvalidOrderError(
          "شناسه تلاش ثبت سفارش نامعتبر است. لطفاً صفحه را دوباره بارگذاری کنید.",
        );
      }
      // Fingerprint customer intent before reading today's catalog. A retry of
      // a committed order must still replay if prices change or the catalog is down.
      if (
        !Array.isArray(body.items) ||
        body.items.length === 0 ||
        body.items.length > MAX_ORDER_LINES
      )
        throw new InvalidOrderError("items are required");
      const requestedItems = body.items
        .map((value) => {
          const item = asRecord(value);
          if (!item || !isOrderQuantity(item.quantity))
            throw new InvalidOrderError("quantity is invalid");
          return {
            productId: requiredString(item.productId, "productId", 100),
            quantity: item.quantity,
          };
        })
        .sort((a, b) =>
          a.productId < b.productId
            ? -1
            : a.productId > b.productId
              ? 1
              : a.quantity - b.quantity,
        );
      if (
        body.couponCode !== undefined &&
        (typeof body.couponCode !== "string" || body.couponCode.length > 50)
      )
        throw new InvalidOrderError("کد تخفیف نامعتبر است.");
      const couponCode =
        typeof body.couponCode === "string"
          ? body.couponCode.trim().toUpperCase()
          : "";
      const requestFingerprint = createHash("sha256")
        .update(
          JSON.stringify({
            customerName,
            phone,
            address,
            items: requestedItems,
            ...(couponCode ? { couponCode } : {}),
          }),
        )
        .digest("hex");
      const respond = (saved: SavedOrder) => {
        if (saved.requestFingerprint !== requestFingerprint)
          throw new IdempotencyConflictError();
        res
          .status(201)
          .json({
            id: String(saved.id),
            orderNumber: saved.orderNumber,
            status: saved.status,
            total: saved.total,
            createdAt: saved.createdAt,
          });
      };
      replay = async () => {
        const saved = await findExisting(idempotencyKey);
        if (!saved) return false;
        respond(saved);
        return true;
      };
      const previous = await findExisting(idempotencyKey);
      if (previous) {
        respond(previous);
        return;
      }
      const items = await resolveOrderItems(body.items, loadProducts);
      const total = quote
        ? await quote(items, couponCode)
        : items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      // orders.total is a PostgreSQL integer. Reject unrepresentable totals
      // before attempting persistence, even when individual quantities are valid.
      if (!Number.isSafeInteger(total) || total > 2_147_483_647) {
        throw new InvalidOrderError("مبلغ سفارش بیش از حد مجاز است.");
      }
      if (body.expectedTotal !== undefined) {
        if (
          typeof body.expectedTotal !== "number" ||
          !Number.isSafeInteger(body.expectedTotal) ||
          body.expectedTotal < 0
        ) {
          throw new InvalidOrderError("expectedTotal is invalid");
        }
        if (body.expectedTotal !== total) {
          throw new PriceChangedError(
            "قیمت محصولات تغییر کرده است. لطفاً سبد خرید را به‌روز و دوباره تأیید کنید.",
          );
        }
      }
      const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
      const saved = await saveOrder({
        orderNumber: `VRS-${date}-${randomBytes(8).toString("hex").toUpperCase()}`,
        idempotencyKey,
        requestFingerprint,
        customerName,
        phone,
        address,
        items,
        total,
        status: "pending",
        ...(couponCode ? { couponCode } : {}),
        ...(customerId ? { customerId } : {}),
      });
      respond(saved);
    } catch (error) {
      // A competing request can commit between the initial lookup and quote.
      // Replay that committed result even if its inventory has since sold out.
      if (replay && !(error instanceof IdempotencyConflictError)) {
        try {
          if (await replay()) return;
        } catch (replayError) {
          if (replayError instanceof IdempotencyConflictError) {
            res
              .status(409)
              .json({ message: "این شناسه قبلاً استفاده شده است." });
            return;
          }
        }
      }
      if (error instanceof StoreError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      if (error instanceof IdempotencyConflictError) {
        res
          .status(409)
          .json({
            message:
              "این شناسه قبلاً برای سفارش دیگری استفاده شده است. لطفاً سفارش را دوباره بررسی کنید.",
          });
        return;
      }
      if (error instanceof CatalogUnavailableError) {
        res.status(503).json({ message: error.message });
        return;
      }
      if (error instanceof PriceChangedError) {
        res.status(409).json({ message: error.message });
        return;
      }
      if (error instanceof InvalidOrderError) {
        res.status(400).json({ message: error.message });
        return;
      }
      req.log?.error({ code: "operation_failed" }, "Failed to create order");
      res
        .status(500)
        .json({ message: "ثبت سفارش انجام نشد. لطفاً دوباره تلاش کنید." });
    }
  };
}
