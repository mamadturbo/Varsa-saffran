import { updateManagedOrder } from './order-status';
import type { ManagementState } from '@workspace/catalog';
import { hasValidAdminToken } from "./admin-auth";
import { createLoginAttemptStore } from "./admin-login-limit";
import { desc, eq } from "drizzle-orm";
import { Router, type Request, type Response } from "express";
import type { db as configuredDatabase } from "@workspace/db";
import {
  ordersTable,
  ORDER_STATUSES,
  type OrderStatus,
} from "@workspace/db/schema";
import type { CatalogProduct } from "@workspace/catalog";

import { createOrderHandler } from "./create-order";
import { loadOrderCatalog } from "./catalog";
import { createOrderRepository } from "./order-repository";
import { priceOrder, type ManagementStore } from './management-store';

export function createOrdersRouter(
  db: typeof configuredDatabase,
  loadProducts: () => Promise<readonly CatalogProduct[]> = loadOrderCatalog,
  management?: ManagementStore,
  identity?: (req: Request, phone: string) => Promise<string | undefined>,
) {
  const router = Router();

  function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : null;
  }

  function requireAdmin(req: Request, res: Response) {
    if (!hasValidAdminToken(req)) {
      res.status(401).json({ message: "دسترسی مدیر لازم است." });
      return false;
    }
    return true;
  }

  function sanitizeOrder(order: typeof ordersTable.$inferSelect) {
    const {
      idempotencyKey: _key,
      requestFingerprint: _fingerprint,
      ...publicOrder
    } = order;
    return {
      ...publicOrder,
      id: String(order.id),
      total: Number(order.total),
    };
  }

  const orderRepository = management ?? createOrderRepository(db);
  router.post(
    "/orders",
    createOrderHandler(
      orderRepository.save,
      loadProducts,
      orderRepository.findByKey,
      management ? async (items, code) => priceOrder(await management.publicState(), items, code).total : undefined,
      identity,
    ),
  );



  router.get("/admin/orders", async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
      const status =
        typeof req.query.status === "string" ? req.query.status : undefined;
      const where =
        status && (ORDER_STATUSES as readonly string[]).includes(status)
          ? eq(ordersTable.status, status as OrderStatus)
          : undefined;

      const orders = await db
        .select()
        .from(ordersTable)
        .where(where)
        .orderBy(desc(ordersTable.createdAt))
        .limit(100);

      res.json({ orders: orders.map(sanitizeOrder) });
    } catch (error) {
      req.log.error({ code: 'operation_failed' }, "Failed to list orders");
      res.status(500).json({ message: "دریافت سفارش‌ها انجام نشد." });
    }
  });

  router.patch("/admin/orders/:id/status", async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
      const id = Number(req.params.id);
      const status = asRecord(req.body)?.status;

      if (
        !Number.isInteger(id) ||
        id < 1 ||
        !ORDER_STATUSES.includes(status as OrderStatus)
      ) {
        res.status(400).json({ message: "وضعیت سفارش نامعتبر است." });
        return;
      }

      if(management) {
        const order=await db.transaction(async raw=>updateManagedOrder({} as ManagementState,raw as unknown as typeof db,id,status as OrderStatus));
        res.json({order});return;
      }
      const [order] = await db
        .update(ordersTable)
        .set({ status: status as OrderStatus, updatedAt: new Date() })
        .where(eq(ordersTable.id, id))
        .returning();

      if (!order) {
        res.status(404).json({ message: "سفارش پیدا نشد." });
        return;
      }

      res.json({ order: sanitizeOrder(order) });
    } catch (error) {
      req.log.error({ code: 'operation_failed' }, "Failed to update order status");
      res.status(500).json({ message: "به‌روزرسانی سفارش انجام نشد." });
    }
  });

  return router;
}

