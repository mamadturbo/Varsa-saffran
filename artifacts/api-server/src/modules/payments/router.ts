import { Router, type Request } from "express";
import { and, eq } from "drizzle-orm";
import {
  customerOrderLinksTable,
  orderDetails,
  ordersTable,
  outbox,
} from "@workspace/db/schema";
import type { Database } from "../catalog/repository";
import type { CustomerServices } from "../customers/router";
import { hasValidAdminToken } from "../../lib/admin-auth";
import { StoreError } from "../../lib/management-store";
import { securityLimit } from "../../lib/security-limit";
import { cardTransferConfig } from "./config";
import { acceptsReceipt, latestReceipt, matchesOrderKey, submitReceipt } from "./service";

export function paymentRoutes(db: Database, customers: CustomerServices) {
  const router = Router(),
    beforeBody = Router();
  async function authorize(req: Request) {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1)
      throw new StoreError("سفارش پیدا نشد.", 404);
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, id));
    if (!order) throw new StoreError("سفارش پیدا نشد.", 404);
    if (
      hasValidAdminToken(req) ||
      matchesOrderKey(order.idempotencyKey, req.get("x-order-key"))
    )
      return order;
    const customer = await customers.auth.read(req);
    const [link] = customer
      ? await db
          .select()
          .from(customerOrderLinksTable)
          .where(
            and(
              eq(customerOrderLinksTable.orderId, id),
              eq(customerOrderLinksTable.customerId, customer.id),
            ),
          )
      : [];
    if (!link)
      throw new StoreError(
        "برای مشاهده پرداخت، از همان مرورگر خرید یا حساب صاحب سفارش وارد شوید.",
        403,
      );
    return order;
  }
  beforeBody.post("/orders/:id/payment/receipt", async (req, _res, next) => {
    try {
      const order = await authorize(req);
      await securityLimit(
        db,
        req,
        "payment-receipt",
        String(order.id),
        10,
        3600,
      );
      next();
    } catch (error) {
      next(error);
    }
  });
  router.get("/payments/card-transfer", (_req, res) => {
    res.set("Cache-Control", "no-store").json(cardTransferConfig());
  });
  router.get("/orders/:id/payment", async (req, res, next) => {
    try {
      const order = await authorize(req);
      const [details] = await db
        .select()
        .from(orderDetails)
        .where(eq(orderDetails.orderId, order.id));
      const receipt = await latestReceipt(db, order.id);
      const [job] = receipt
        ? await db
            .select()
            .from(outbox)
            .where(eq(outbox.id, `bale-receipt:${receipt.id}`))
        : [];
      res
        .set("Cache-Control", "no-store")
        .json({
          order: {
            id: String(order.id),
            orderNumber: order.orderNumber,
            total: order.total,
            status: order.status,
          },
          paymentStatus: details?.paymentStatus ?? "unpaid",
          shippingConfigured: !!details?.meta.shippingConfigured,
          canSubmitReceipt: acceptsReceipt(order.status, details),
          config: cardTransferConfig(),
          receipt: receipt
            ? {
                id: receipt.id,
                status: receipt.status,
                createdAt: receipt.createdAt,
                deliveryStatus: job?.status ?? "pending",
              }
            : null,
        });
    } catch (error) {
      next(error);
    }
  });
  router.post("/orders/:id/payment/receipt", async (req, res, next) => {
    try {
      const order = await authorize(req);
      const { data, mime } = req.body ?? {};
      if (typeof data !== "string" || typeof mime !== "string")
        throw new StoreError("عکس رسید را انتخاب کنید.");
      const receipt = await submitReceipt(db, order.id, data, mime);
      res
        .status(201)
        .set("Cache-Control", "no-store")
        .json({ receipt: { id: receipt.id, status: receipt.status } });
    } catch (error) {
      next(error);
    }
  });
  router.post("/orders/:id/payment/retry", async (req, res, next) => {
    try {
      const order = await authorize(req);
      await securityLimit(db, req, "payment-retry", String(order.id), 5, 3600);
      const receipt = await latestReceipt(db, order.id);
      if (receipt?.status === "pending")
        await db
          .update(outbox)
          .set({
            status: "pending",
            attempts: 0,
            availableAt: new Date(),
            lastError: null,
          })
          .where(
            and(
              eq(outbox.id, `bale-receipt:${receipt.id}`),
              eq(outbox.status, "failed"),
            ),
          );
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
  return { router, beforeBody };
}
