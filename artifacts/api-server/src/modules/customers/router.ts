import { readState } from "../catalog/repository";
import { readProfile, saveProfile } from "./repository";
import { readCase, saveMessages, caseViews } from "../support/repository";
import { fileService, encodeUpload } from "../files/storage";
import { enqueueLegacySms, processOne } from "../notifications/queue";
import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { and, desc, eq, inArray, or, lt, sql } from "drizzle-orm";
import type { db } from "@workspace/db";
import {
  customersTable,
  customerOrderLinksTable,
  ordersTable,
  customerCasesTable,
  customerNotificationsTable,
  customerReviewsTable,
  customerMediaTable,
  storeConfig,
  orderDetails,
  files,
  outbox,
} from "@workspace/db/schema";
import type {
  CustomerProfile,
  CustomerAddress,
  CasePayload,
  Customer,
} from "@workspace/catalog";
import { normalizeIranMobile, contactEmail } from "@workspace/validation";
import {
  createCustomerAuth,
  enforceCustomerOrigin,
  sendCustomerSms,
} from "../../lib/customer-auth";
import { hasValidAdminToken } from "../../lib/admin-auth";
import { StoreError, type ManagementStore } from "../../lib/management-store";
import {
  updateManagedOrder,
  type OrderChangeHook,
} from "../../lib/order-status";

const obj = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new StoreError("اطلاعات نامعتبر است.");
  return v as Record<string, unknown>;
};
const text = (v: unknown, max = 2000, required = true) => {
  if (typeof v !== "string" || v.trim().length > max || (required && !v.trim()))
    throw new StoreError("اطلاعات واردشده کامل یا معتبر نیست.");
  return v.trim();
};
const idNumber = (v: unknown) => {
  const id = Number(v);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new StoreError("شناسه نامعتبر است.");
  return id;
};
const statusLabels: Record<string, string> = {
  pending: "در انتظار بررسی",
  confirmed: "تأییدشده",
  processing: "در حال آماده‌سازی",
  shipped: "ارسال‌شده",
  delivered: "تحویل‌شده",
  cancelled: "لغوشده",
};

export function createCustomerServices(
  database: typeof db,
  store: ManagementStore,
  sender = sendCustomerSms,
) {
  const auth = createCustomerAuth(database, sender);
  const notify = async (
    tx: typeof database,
    cid: string,
    title: string,
    message: string,
    orderId: number | null = null,
    smsEnabled = false,
  ) => {
    const [owner] = await tx
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, cid));
    const profile = owner?.profile as unknown as CustomerProfile | undefined;
    const [notification] = await tx
      .insert(customerNotificationsTable)
      .values({
        customerId: cid,
        title,
        message,
        orderId,
        smsStatus: smsEnabled && profile?.smsUpdates ? "pending" : "disabled",
      })
      .returning();
    if (notification.smsStatus === "pending")
      await tx.insert(outbox).values({
        id: `sms:${notification.id}`,
        kind: "sms.notification",
        payload: { notificationId: notification.id },
      });
  };
  const flushSms = async () => {
    await enqueueLegacySms(database);
    for (let i = 0; i < 100 && (await processOne(database, sender)); i++) {
      /* bounded explicit drain */
    }
  };
  const onOrderChange: OrderChangeHook = async (tx, order) => {
    const [link] = await tx
      .select()
      .from(customerOrderLinksTable)
      .where(eq(customerOrderLinksTable.orderId, order.id));
    if (link) {
      const [settings] = await tx
        .select()
        .from(storeConfig)
        .where(eq(storeConfig.id, "main"));
      await notify(
        tx,
        link.customerId,
        "وضعیت سفارش تغییر کرد",
        `سفارش ${order.orderNumber}: ${statusLabels[order.status] ?? order.status}`,
        order.id,
        (settings.settings as { transactionalSmsEnabled?: boolean })
          .transactionalSmsEnabled ?? false,
      );
    }
  };
  const afterChange = async () => {
    // Delivery belongs to the independent worker; HTTP only commits outbox rows.
  };
  const identity = async (req: Request, phone: string) => {
    enforceCustomerOrigin(req);
    const c = await auth.read(req);
    if (c && c.phone !== phone)
      throw new StoreError(
        "شماره سفارش باید با شماره تأییدشده حساب یکسان باشد.",
      );
    return c?.id;
  };
  return { auth, notify, flushSms, onOrderChange, afterChange, identity };
}
export type CustomerServices = ReturnType<typeof createCustomerServices>;

export function createCustomerRouter(
  database: typeof db,
  store: ManagementStore,
  services: CustomerServices,
) {
  const router = Router();
  const { auth, notify } = services;
  const route =
    (fn: (req: Request, res: Response) => Promise<unknown>) =>
    async (req: Request, res: Response) => {
      try {
        enforceCustomerOrigin(req);
        res.set("Cache-Control", "no-store");
        await fn(req, res);
      } catch (error) {
        if (error instanceof StoreError) {
          if (error.status === 429) res.set("Retry-After", "60");
          res.status(error.status).json({ message: error.message });
        } else {
          req.log?.error(
            { code: "operation_failed" },
            "Customer request failed",
          );
          res.status(503).json({
            message: "دریافت یا ذخیره اطلاعات انجام نشد. دوباره تلاش کنید.",
          });
        }
      }
    };
  const admin = (req: Request) => {
    if (!hasValidAdminToken(req))
      throw new StoreError("دسترسی مدیر لازم است.", 401);
  };
  const profileUpdate = async (cid: string, fn: (p: CustomerProfile) => void) =>
    database.transaction(async (raw) => {
      const tx = raw as unknown as typeof database;
      const [row] = await tx
        .select()
        .from(customersTable)
        .where(eq(customersTable.id, cid))
        .for("update");
      const p = await readProfile(tx, row);
      fn(p);
      await saveProfile(tx, cid, p);
      return { id: row.id, phone: row.phone, profile: p };
    });
  const owns = async (tx: typeof database, cid: string, id: number) => {
    const [link] = await tx
      .select()
      .from(customerOrderLinksTable)
      .where(
        and(
          eq(customerOrderLinksTable.orderId, id),
          eq(customerOrderLinksTable.customerId, cid),
        ),
      );
    if (!link) throw new StoreError("سفارش پیدا نشد.", 404);
    const [order] = await tx
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .for("update");
    if (!order) throw new StoreError("سفارش پیدا نشد.", 404);
    return order;
  };
  const attachments = async (
    tx: typeof database,
    cid: string,
    value: unknown,
  ) => {
    if (value === undefined) return [] as string[];
    if (
      !Array.isArray(value) ||
      value.length > 3 ||
      value.some(
        (v) =>
          typeof v !== "string" ||
          !/^\/api\/customer\/media\/[a-f0-9-]{36}$/.test(v),
      )
    )
      throw new StoreError("حداکثر سه تصویر معتبر انتخاب کنید.");
    const urls = value as string[];
    for (const u of urls) {
      const [media] = await tx
        .select({ id: customerMediaTable.id })
        .from(customerMediaTable)
        .where(
          and(
            eq(customerMediaTable.id, u.split("/").at(-1)!),
            eq(customerMediaTable.customerId, cid),
          ),
        );
      const [mapped] = await tx
        .select({ id: files.id })
        .from(files)
        .where(and(eq(files.id, u.split("/").at(-1)!), eq(files.ownerId, cid)));
      if (!media && !mapped) throw new StoreError("تصویر پیوست معتبر نیست.");
    }
    return urls;
  };
  router.post(
    "/customer/auth/request",
    route(async (req, res) =>
      res.json(await auth.requestCode(req, obj(req.body).phone)),
    ),
  );
  router.post(
    "/customer/auth/verify",
    route(async (req, res) => {
      const b = obj(req.body);
      res.json({ customer: await auth.verify(req, res, b.phone, b.code) });
    }),
  );
  router.post(
    '/customer/auth/change-phone',
    route(async(req,res)=>{await auth.changePhone(req,res,obj(req.body));res.json({ok:true,signInRequired:true});}),
  );
  router.post(
    "/customer/auth/logout",
    route(async (req, res) => {
      await auth.logout(req, res);
      res.json({ ok: true });
    }),
  );
  router.get(
    "/customer/me",
    route(async (req, res) => res.json({ customer: await auth.read(req) })),
  );
  router.get(
    "/customer/dashboard",
    route(async (req, res) => {
      const c = await auth.requireCustomer(req);
      const state = await store.publicState();
      const joined = await database
        .select({ order: ordersTable, details: orderDetails })
        .from(customerOrderLinksTable)
        .innerJoin(
          ordersTable,
          eq(ordersTable.id, customerOrderLinksTable.orderId),
        )
        .leftJoin(orderDetails, eq(orderDetails.orderId, ordersTable.id))
        .where(eq(customerOrderLinksTable.customerId, c.id))
        .orderBy(desc(ordersTable.createdAt));
      const [cases, notifications, reviews] = await Promise.all([
        database
          .select()
          .from(customerCasesTable)
          .where(eq(customerCasesTable.customerId, c.id))
          .orderBy(desc(customerCasesTable.updatedAt)),
        database
          .select()
          .from(customerNotificationsTable)
          .where(eq(customerNotificationsTable.customerId, c.id))
          .orderBy(desc(customerNotificationsTable.createdAt))
          .limit(100),
        database
          .select()
          .from(customerReviewsTable)
          .where(eq(customerReviewsTable.customerId, c.id)),
      ]);
      res.json({
        customer: c,
        orders: joined.map(
          ({
            order: { idempotencyKey: _k, requestFingerprint: _f, ...o },
            details,
          }) => ({
            ...o,
            id: String(o.id),
            management: details?.meta ?? null,
            paymentStatus: details?.paymentStatus ?? "unpaid",
          }),
        ),
        cases: await caseViews(database, cases),
        notifications,
        reviews,
        returnWindowDays: state.settings.returnWindowDays ?? 7,
      });
    }),
  );
  router.put(
    "/customer/profile",
    route(async (req, res) => {
      const c = await auth.requireCustomer(req),
        b = obj(req.body);
      const name = text(b.name, 120, false),
        email = text(b.email, 200, false);
      if (email && !contactEmail(email))
        throw new StoreError("ایمیل معتبر وارد کنید.");
      if (typeof b.smsUpdates !== "boolean")
        throw new StoreError("تنظیم پیامک نامعتبر است.");
      res.json({
        customer: await profileUpdate(c.id, (p) => {
          p.name = name;
          p.email = email;
          p.smsUpdates = b.smsUpdates as boolean;
        }),
      });
    }),
  );
  router.put(
    "/customer/addresses/:id",
    route(async (req, res) => {
      const c = await auth.requireCustomer(req),
        b = obj(req.body);
      const id = text(req.params.id, 100);
      const phone = normalizeIranMobile(b.phone);
      const postalCode = text(b.postalCode, 10).replace(/[۰-۹]/g, (d) =>
        String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
      );
      if (!phone || !/^\d{10}$/.test(postalCode))
        throw new StoreError("شماره گیرنده و کد پستی ده‌رقمی معتبر وارد کنید.");
      const a: CustomerAddress = {
        id,
        label: text(b.label, 80),
        recipient: text(b.recipient, 120),
        phone,
        province: text(b.province, 80),
        city: text(b.city, 80),
        address: text(b.address, 1000),
        postalCode,
        isDefault: b.isDefault === true,
      };
      res.json({
        customer: await profileUpdate(c.id, (p) => {
          const index = p.addresses.findIndex((v) => v.id === id);
          if (index < 0 && p.addresses.length >= 10)
            throw new StoreError("حداکثر ده آدرس قابل ذخیره است.");
          if (a.isDefault)
            p.addresses.forEach((v) => {
              v.isDefault = false;
            });
          if (index < 0) p.addresses.push(a);
          else p.addresses[index] = a;
          if (!p.addresses.some((v) => v.isDefault))
            p.addresses[0].isDefault = true;
        }),
      });
    }),
  );
  router.delete(
    "/customer/addresses/:id",
    route(async (req, res) => {
      const c = await auth.requireCustomer(req);
      res.json({
        customer: await profileUpdate(c.id, (p) => {
          p.addresses = p.addresses.filter((a) => a.id !== req.params.id);
          if (p.addresses.length && !p.addresses.some((a) => a.isDefault))
            p.addresses[0].isDefault = true;
        }),
      });
    }),
  );
  router.put(
    "/customer/favorites",
    route(async (req, res) => {
      const c = await auth.requireCustomer(req);
      const ids = obj(req.body).ids;
      if (
        !Array.isArray(ids) ||
        ids.length > 100 ||
        ids.some((id) => typeof id !== "string")
      )
        throw new StoreError("فهرست علاقه‌مندی نامعتبر است.");
      const products = (await store.read()).products;
      const known = [...new Set(ids as string[])].filter((id) =>
        products.some((p) => p.id === id),
      );
      res.json({
        customer: await profileUpdate(c.id, (p) => {
          p.favorites = known;
        }),
      });
    }),
  );
  router.post(
    "/customer/claim-order",
    route(async (req, res) => {
      const c = await auth.requireCustomer(req);
      await auth.limit(`claim:${c.id}`, 10, 3600);
      const code = text(obj(req.body).orderNumber, 32).toUpperCase();
      await database.transaction(async (raw) => {
        const tx = raw as unknown as typeof database;
        const [order] = await tx
          .select()
          .from(ordersTable)
          .where(
            and(
              eq(ordersTable.orderNumber, code),
              eq(ordersTable.phone, c.phone),
            ),
          );
        if (!order)
          throw new StoreError(
            "سفارشی با این کد و شماره تأییدشده پیدا نشد.",
            404,
          );
        const [link] = await tx
          .select()
          .from(customerOrderLinksTable)
          .where(eq(customerOrderLinksTable.orderId, order.id));
        if (link && link.customerId !== c.id)
          throw new StoreError("سفارش قابل افزودن به این حساب نیست.", 409);
        await tx
          .insert(customerOrderLinksTable)
          .values({ orderId: order.id, customerId: c.id })
          .onConflictDoNothing();
      });
      res.json({ ok: true });
    }),
  );
  router.post(
    "/customer/cases",
    route(async (req, res) => {
      const c = await auth.requireCustomer(req);
      await auth.limit(`case:${c.id}`, 20, 3600);
      const b = obj(req.body);
      const kind = text(b.kind, 20);
      if (!["ticket", "cancel", "return"].includes(kind))
        throw new StoreError("نوع درخواست نامعتبر است.");
      const orderId = b.orderId ? idNumber(b.orderId) : null;
      if (kind !== "ticket" && !orderId)
        throw new StoreError("سفارش را انتخاب کنید.");
      const id = randomUUID();
      await database.transaction(async (raw) => {
        const tx = raw as unknown as typeof database;
        const s = await readState(tx, false);
        const order = orderId ? await owns(tx, c.id, orderId) : null;
        if (
          kind === "cancel" &&
          order &&
          !["pending", "confirmed", "processing"].includes(order.status)
        )
          throw new StoreError("این سفارش دیگر قابل درخواست لغو نیست.");
        if (kind === "return" && order) {
          const [detail] = await tx
            .select()
            .from(orderDetails)
            .where(eq(orderDetails.orderId, order.id));
          const deliveredAt = String(
            detail?.meta.deliveredAt ?? order.updatedAt.toISOString(),
          );
          if (
            order.status !== "delivered" ||
            Date.now() >
              Date.parse(deliveredAt) +
                (s.settings.returnWindowDays ?? 7) * 86400000
          )
            throw new StoreError("این سفارش در بازه مجاز درخواست مرجوعی نیست.");
        }
        if (kind !== "ticket") {
          const rows = await tx
            .select()
            .from(customerCasesTable)
            .where(
              and(
                eq(customerCasesTable.customerId, c.id),
                eq(customerCasesTable.orderId, orderId!),
                eq(customerCasesTable.kind, kind),
              ),
            );
          if (rows.some((r) => !["closed", "rejected"].includes(r.status)))
            throw new StoreError(
              "برای این سفارش قبلاً درخواست مشابه ثبت شده است.",
              409,
            );
        }
        const payload: CasePayload = {
          subject: text(b.subject, 200),
          messages: [
            {
              id: randomUUID(),
              author: "customer",
              text: text(b.message, 5000),
              images: await attachments(tx, c.id, b.images),
              createdAt: new Date().toISOString(),
            },
          ],
          resolution: "",
        };
        await tx.insert(customerCasesTable).values({
          id,
          customerId: c.id,
          orderId,
          kind,
          status: "waiting_admin",
          payload: { subject: payload.subject, resolution: payload.resolution },
        });
        await saveMessages(tx, id, payload);
      });
      res.status(201).json({ id });
    }),
  );
  router.post(
    "/customer/cases/:id/reply",
    route(async (req, res) => {
      const c = await auth.requireCustomer(req),
        b = obj(req.body);
      await auth.limit(`reply:${c.id}`, 60, 3600);
      await database.transaction(async (raw) => {
        const tx = raw as unknown as typeof database;
        const [row] = await tx
          .select()
          .from(customerCasesTable)
          .where(
            and(
              eq(customerCasesTable.id, String(req.params.id)),
              eq(customerCasesTable.customerId, c.id),
            ),
          )
          .for("update");
        if (!row) throw new StoreError("درخواست پیدا نشد.", 404);
        if (["approved", "rejected"].includes(row.status))
          throw new StoreError(
            "این درخواست بررسی و نهایی شده است. برای ادامه تیکت جدید ثبت کنید.",
          );
        const payload = await readCase(tx, row);
        if (payload.messages.length >= 100)
          throw new StoreError("برای ادامه گفت‌وگو تیکت جدید ثبت کنید.");
        payload.messages.push({
          id: randomUUID(),
          author: "customer",
          text: text(b.message, 5000),
          images: await attachments(tx, c.id, b.images),
          createdAt: new Date().toISOString(),
        });
        await tx
          .update(customerCasesTable)
          .set({
            payload: {
              subject: payload.subject,
              resolution: payload.resolution,
            },
            status: "waiting_admin",
            updatedAt: new Date(),
          })
          .where(eq(customerCasesTable.id, row.id));
        await saveMessages(tx, row.id, payload);
      });
      res.json({ ok: true });
    }),
  );
  router.post(
    "/customer/notifications/read",
    route(async (req, res) => {
      const c = await auth.requireCustomer(req);
      await database
        .update(customerNotificationsTable)
        .set({ readAt: new Date() })
        .where(eq(customerNotificationsTable.customerId, c.id));
      res.json({ ok: true });
    }),
  );
  router.put(
    "/customer/reviews/:productId",
    route(async (req, res) => {
      const c = await auth.requireCustomer(req),
        b = obj(req.body),
        productId = text(req.params.productId, 100);
      const rating = Number(b.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5)
        throw new StoreError("امتیاز بین یک تا پنج انتخاب کنید.");
      const owned = await database
        .select({ order: ordersTable })
        .from(customerOrderLinksTable)
        .innerJoin(
          ordersTable,
          eq(ordersTable.id, customerOrderLinksTable.orderId),
        )
        .where(
          and(
            eq(customerOrderLinksTable.customerId, c.id),
            eq(ordersTable.status, "delivered"),
          ),
        );
      if (
        !owned.some((o) => o.order.items.some((i) => i.productId === productId))
      )
        throw new StoreError(
          "پس از تحویل این محصول می‌توانید نظر ثبت کنید.",
          403,
        );
      const values = {
        customerId: c.id,
        productId,
        rating,
        body: text(b.body, 3000),
        author: c.profile.name.trim().split(/\s+/)[0] || "خریدار ورسا",
        published: false,
        updatedAt: new Date(),
      };
      await database
        .insert(customerReviewsTable)
        .values({ id: randomUUID(), ...values })
        .onConflictDoUpdate({
          target: [
            customerReviewsTable.customerId,
            customerReviewsTable.productId,
          ],
          set: values,
        });
      res.json({ ok: true });
    }),
  );
  router.get(
    "/store/reviews/:productId",
    route(async (req, res) => {
      const rows = await database
        .select({
          id: customerReviewsTable.id,
          rating: customerReviewsTable.rating,
          body: customerReviewsTable.body,
          author: customerReviewsTable.author,
          updatedAt: customerReviewsTable.updatedAt,
        })
        .from(customerReviewsTable)
        .where(
          and(
            eq(customerReviewsTable.productId, String(req.params.productId)),
            eq(customerReviewsTable.published, true),
          ),
        )
        .orderBy(desc(customerReviewsTable.updatedAt));
      res.json({
        reviews: rows,
        average: rows.length
          ? rows.reduce((n, r) => n + r.rating, 0) / rows.length
          : null,
        count: rows.length,
      });
    }),
  );
  router.post(
    "/customer/media",
    route(async (req, res) => {
      const b = obj(req.body);
      const isAdmin = hasValidAdminToken(req);
      const c = isAdmin ? null : await auth.requireCustomer(req);
      const cid = c?.id ?? text(b.customerId, 100);
      await auth.limit(`media:${cid}`, 30, 3600);
      const mime = text(b.mime, 30),
        data = text(b.data, 5600000);
      const clean = await encodeUpload(data, mime);
      const id = randomUUID();
      await fileService(database).save(id, clean.bytes, clean.mime, cid);
      res.status(201).json({ url: `/api/customer/media/${id}` });
    }),
  );
  router.get(
    "/customer/media/:id",
    route(async (req, res) => {
      const c = await auth.read(req);
      const mapped = await fileService(database).read(
        String(req.params.id),
        c?.id,
        hasValidAdminToken(req),
      );
      if (mapped) {
        res
          .set({
            "Content-Type": mapped.mime,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
          })
          .send(mapped.bytes);
        return;
      }
      const [media] = await database
        .select()
        .from(customerMediaTable)
        .where(eq(customerMediaTable.id, String(req.params.id)));
      if (!media || (!hasValidAdminToken(req) && media.customerId !== c?.id))
        throw new StoreError("تصویر پیدا نشد.", 404);
      res
        .set({
          "Content-Type": media.mime,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
        })
        .send(Buffer.from(media.data, "base64"));
    }),
  );
  router.get(
    "/admin/customer-service",
    route(async (req, res) => {
      admin(req);
      const [cases, reviews, notifications, customers] = await Promise.all([
        database
          .select()
          .from(customerCasesTable)
          .orderBy(desc(customerCasesTable.updatedAt)),
        database
          .select()
          .from(customerReviewsTable)
          .orderBy(desc(customerReviewsTable.updatedAt)),
        database
          .select()
          .from(customerNotificationsTable)
          .where(
            inArray(customerNotificationsTable.smsStatus, [
              "failed",
              "sending",
              "pending",
            ]),
          ),
        database
          .select({
            id: customersTable.id,
            phone: customersTable.phone,
            profile: customersTable.profile,
          })
          .from(customersTable),
      ]);
      res.json({
        cases: await caseViews(database, cases),
        reviews,
        notifications,
        customers,
      });
    }),
  );
  router.post(
    "/admin/customer-service/cases/:id",
    route(async (req, res) => {
      admin(req);
      const b = obj(req.body);
      const next = text(b.status, 30);
      const message = text(b.message, 5000);
      await database.transaction(async (raw) => {
        const tx = raw as unknown as typeof database;
        const s = await readState(tx, false);
        const [row] = await tx
          .select()
          .from(customerCasesTable)
          .where(eq(customerCasesTable.id, String(req.params.id)))
          .for("update");
        if (!row) throw new StoreError("درخواست پیدا نشد.", 404);
        if (["approved", "rejected"].includes(row.status))
          throw new StoreError("این درخواست قبلاً نهایی شده است.", 409);
        if (
          row.kind === "ticket"
            ? !["waiting_customer", "closed"].includes(next)
            : !["approved", "rejected", "waiting_customer"].includes(next)
        )
          throw new StoreError("وضعیت انتخابی معتبر نیست.");
        if (row.kind === "cancel" && next === "approved" && row.orderId) {
          const [order] = await tx
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, row.orderId));
          if (
            !order ||
            !["pending", "confirmed", "processing", "cancelled"].includes(
              order.status,
            )
          )
            throw new StoreError("سفارش ارسال شده و دیگر قابل لغو نیست.", 409);
          await updateManagedOrder(
            s,
            tx,
            row.orderId,
            "cancelled",
            undefined,
            services.onOrderChange,
          );
        }
        const payload = await readCase(tx, row);
        payload.messages.push({
          id: randomUUID(),
          author: "admin",
          text: message,
          images: await attachments(tx, row.customerId, b.images),
          createdAt: new Date().toISOString(),
        });
        if (["approved", "rejected"].includes(next))
          payload.resolution = message;
        await tx
          .update(customerCasesTable)
          .set({
            payload: {
              subject: payload.subject,
              resolution: payload.resolution,
            },
            status: next,
            updatedAt: new Date(),
          })
          .where(eq(customerCasesTable.id, row.id));
        await saveMessages(tx, row.id, payload);
        await notify(
          tx,
          row.customerId,
          "پاسخ فروشگاه دریافت شد",
          `درخواست «${payload.subject}» به‌روز شد.`,
          row.orderId,
          s.settings.transactionalSmsEnabled ?? false,
        );
      });
      void services.afterChange();
      res.json({ ok: true });
    }),
  );
  router.patch(
    "/admin/customer-service/reviews/:id",
    route(async (req, res) => {
      admin(req);
      const b = obj(req.body);
      if (typeof b.published !== "boolean")
        throw new StoreError("وضعیت انتشار نامعتبر است.");
      const [r] = await database
        .update(customerReviewsTable)
        .set({ published: b.published })
        .where(eq(customerReviewsTable.id, String(req.params.id)))
        .returning();
      if (!r) throw new StoreError("نظر پیدا نشد.", 404);
      res.json({ ok: true });
    }),
  );
  router.post(
    "/admin/customer-service/retry-sms",
    route(async (req, res) => {
      admin(req);
      await database.transaction(async (raw) => {
        const tx = raw as unknown as typeof database;
        const failed = await tx
          .update(outbox)
          .set({
            status: "pending",
            attempts: 0,
            availableAt: new Date(),
            lastError: null,
          })
          .where(
            and(
              eq(outbox.status, "failed"),
              eq(outbox.kind, "sms.notification"),
            ),
          )
          .returning();
        for (const job of failed.filter((j) => j.kind === "sms.notification"))
          await tx
            .update(customerNotificationsTable)
            .set({ smsStatus: "pending" })
            .where(
              eq(
                customerNotificationsTable.id,
                Number(job.payload.notificationId),
              ),
            );
      });
      res.json({ ok: true });
    }),
  );
  return router;
}
