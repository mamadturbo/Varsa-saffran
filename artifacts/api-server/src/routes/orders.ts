import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { Router, type Request, type Response } from "express";
import { db, ordersTable, ORDER_STATUSES, type OrderItem, type OrderStatus } from "@workspace/db";

const router = Router();
const ADMIN_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new Error(`${field} is required`);
  }
  const result = value.trim();
  if (!result || result.length > maxLength) {
    throw new Error(`${field} is invalid`);
  }
  return result;
}

function positiveInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 99) {
    throw new Error("quantity is invalid");
  }
  return value;
}

function parseOrderItems(value: unknown): OrderItem[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) {
    throw new Error("items are required");
  }

  return value.map((rawItem) => {
    const item = asRecord(rawItem);
    if (!item) throw new Error("item is invalid");

    const unitPrice = item.unitPrice;
    if (typeof unitPrice !== "number" || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error("unitPrice is invalid");
    }

    const result: OrderItem = {
      productId: requiredString(item.productId, "productId", 100),
      name: requiredString(item.name, "name", 200),
      quantity: positiveInteger(item.quantity),
      unitPrice: Math.round(unitPrice),
    };

    if (typeof item.imageUrl === "string" && item.imageUrl.length <= 1000) {
      result.imageUrl = item.imageUrl;
    }

    return result;
  });
}

function createOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `VRS-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function tokenSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  return secret;
}

function signAdminToken(payload: string) {
  return createHmac("sha256", tokenSecret()).update(payload).digest("base64url");
}

function createAdminToken() {
  const payload = Buffer.from(
    JSON.stringify({ expiresAt: Date.now() + ADMIN_TOKEN_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${signAdminToken(payload)}`;
}

function hasValidAdminToken(req: Request) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const token = header.slice("Bearer ".length);
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  try {
    const expected = signAdminToken(payload);
    const signaturesMatch =
      signature.length === expected.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!signaturesMatch) return false;

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      expiresAt?: unknown;
    };
    return typeof decoded.expiresAt === "number" && decoded.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req: Request, res: Response) {
  if (!hasValidAdminToken(req)) {
    res.status(401).json({ message: "دسترسی مدیر لازم است." });
    return false;
  }
  return true;
}

function sanitizeOrder(order: typeof ordersTable.$inferSelect) {
  return {
    ...order,
    id: String(order.id),
    total: Number(order.total),
  };
}

router.post("/orders", async (req, res) => {
  try {
    const body = asRecord(req.body);
    if (!body) {
      res.status(400).json({ message: "اطلاعات سفارش نامعتبر است." });
      return;
    }

    const customerName = requiredString(body.customerName, "customerName", 120);
    const phone = requiredString(body.phone, "phone", 32);
    const address = requiredString(body.address, "address", 1000);
    const items = parseOrderItems(body.items);
    const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    const [order] = await db
      .insert(ordersTable)
      .values({
        orderNumber: createOrderNumber(),
        customerName,
        phone,
        address,
        items,
        total,
        status: "pending",
      })
      .returning();

    res.status(201).json({
      id: String(order.id),
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to create order");
    res.status(400).json({
      message: error instanceof Error ? error.message : "ثبت سفارش انجام نشد.",
    });
  }
});

router.post("/admin/login", async (req, res) => {
  try {
    const configuredPassword = process.env.VARSA_ADMIN_PASSWORD;
    const providedPassword = asRecord(req.body)?.password;

    if (!configuredPassword || typeof providedPassword !== "string") {
      res.status(401).json({ message: "رمز مدیر نادرست است." });
      return;
    }

    const provided = Buffer.from(providedPassword);
    const expected = Buffer.from(configuredPassword);
    const matches =
      provided.length === expected.length && timingSafeEqual(provided, expected);

    if (!matches) {
      res.status(401).json({ message: "رمز مدیر نادرست است." });
      return;
    }

    res.json({ token: createAdminToken() });
  } catch (error) {
    req.log.error({ err: error }, "Admin login failed");
    res.status(503).json({ message: "ورود مدیر موقتاً در دسترس نیست." });
  }
});

router.get("/admin/orders", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
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
    req.log.error({ err: error }, "Failed to list orders");
    res.status(500).json({ message: "دریافت سفارش‌ها انجام نشد." });
  }
});

router.patch("/admin/orders/:id/status", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const id = Number(req.params.id);
    const status = asRecord(req.body)?.status;

    if (!Number.isInteger(id) || id < 1 || !ORDER_STATUSES.includes(status as OrderStatus)) {
      res.status(400).json({ message: "وضعیت سفارش نامعتبر است." });
      return;
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
    req.log.error({ err: error }, "Failed to update order status");
    res.status(500).json({ message: "به‌روزرسانی سفارش انجام نشد." });
  }
});

export default router;