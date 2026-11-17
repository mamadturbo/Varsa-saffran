import { importLegacyArticles } from "../content/service";
import { fileService, encodeUpload } from "../files/storage";
import { randomUUID } from "node:crypto";
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { desc, eq } from "drizzle-orm";
import type { db } from "@workspace/db";
import {
  ordersTable,
  ORDER_STATUSES,
  storeMediaTable,
  type OrderStatus,
} from "@workspace/db/schema";
import {
  parseCatalogProduct,
  type ManagementState,
  type ManagedArticle,
  type Coupon,
  type Banner,
  type StoreSettings,
} from "@workspace/catalog";
import {
  isOrderQuantity,
  contactPhone,
  contactEmail,
  contactProfile,
  MAX_ORDER_LINES,
} from "@workspace/validation";
import { hasValidAdminToken } from "../../lib/admin-auth";
import {
  updateManagedOrder,
  type OrderChangeHook,
} from "../../lib/order-status";
import {
  priceOrder,
  StoreError,
  type ManagementStore,
} from "../../lib/management-store";

const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new StoreError("اطلاعات نامعتبر است.");
  return v as Record<string, unknown>;
};
const str = (v: unknown, max = 500, required = false) => {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    throw new StoreError("متن واردشده نامعتبر است.");
  return v.trim();
};
const num = (v: unknown, max = 2_147_483_647) => {
  if (!Number.isSafeInteger(v) || (v as number) < 0 || (v as number) > max)
    throw new StoreError("عدد واردشده نامعتبر است.");
  return v as number;
};
const bool = (v: unknown) => {
  if (typeof v !== "boolean") throw new StoreError("مقدار نامعتبر است.");
  return v;
};
const url = (v: unknown, required = false) => {
  const s = str(v, 2048, required);
  if (
    s &&
    !(/^https?:\/\//i.test(s) || (/^\/(?!\/)/.test(s) && !/[\\\r\n]/.test(s)))
  )
    throw new StoreError("نشانی تصویر یا لینک نامعتبر است.");
  return s;
};

export function createManagementRouter(
  database: typeof db,
  store: ManagementStore,
  onOrderChange?: OrderChangeHook,
  afterOrderChange?: () => Promise<void>,
) {
  const router = Router();
  const route =
    (fn: (req: Request, res: Response) => Promise<unknown>) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await fn(req, res);
      } catch (error) {
        if (error instanceof StoreError) {
          res.status(error.status).json({ message: error.message });
          return;
        }
        req.log?.error(
          { code: "operation_failed" },
          "Store management request failed",
        );
        res.status(503).json({
          message: "ارتباط با اطلاعات فروشگاه برقرار نشد. دوباره تلاش کنید.",
        });
      }
    };
  router.use("/admin", (req, res, next) => {
    if (req.path === "/login" && req.method === "POST") {
      next();
      return;
    }
    if (!hasValidAdminToken(req)) {
      res.status(401).json({ message: "برای ادامه دوباره وارد پنل شوید." });
      return;
    }
    next();
  });
  router.get(
    "/store/products",
    route(async (_req, res) => {
      res
        .set("Cache-Control", "no-store")
        .json(
          (await store.publicState()).products
            .filter((p) => p.active)
            .sort(
              (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
            ),
        );
    }),
  );
  router.get(
    "/store/content",
    route(async (_req, res) => {
      const s = await store.publicState();
      res.set("Cache-Control", "no-store").json({
        banners: s.banners.filter((b) => b.active),
        settings: s.settings,
        articles: s.articles?.filter((a) => a.published) ?? null,
        useLegacyArticles: s.legacyArticlesEnabled ?? s.articles === null,
      });
    }),
  );
  router.post(
    "/store/quote",
    route(async (req, res) => {
      const body = record(req.body);
      if (
        !Array.isArray(body.items) ||
        !body.items.length ||
        body.items.length > MAX_ORDER_LINES
      )
        throw new StoreError("سبد خرید نامعتبر است.");
      const combined = new Map<string, number>();
      for (const raw of body.items) {
        const i = record(raw);
        const id = str(i.productId, 100, true);
        if (!isOrderQuantity(i.quantity))
          throw new StoreError("تعداد نامعتبر است.");
        combined.set(id, (combined.get(id) ?? 0) + (i.quantity as number));
      }
      const items = [...combined].map(([productId, quantity]) => {
        if (!isOrderQuantity(quantity))
          throw new StoreError("تعداد نامعتبر است.");
        return { productId, quantity };
      });
      res.json(
        priceOrder(
          await store.publicState(),
          items,
          body.couponCode === undefined ? "" : str(body.couponCode, 50),
        ),
      );
    }),
  );
  router.get(
    "/media/:id",
    route(async (req, res) => {
      const mapped = await fileService(database).read(String(req.params.id));
      if (mapped) {
        res
          .set({
            "Content-Type": mapped.mime,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "public, max-age=31536000, immutable",
          })
          .send(mapped.bytes);
        return;
      }
      const [media] = await database
        .select()
        .from(storeMediaTable)
        .where(eq(storeMediaTable.id, String(req.params.id)));
      if (!media) {
        res.sendStatus(404);
        return;
      }
      res
        .set({
          "Content-Type": media.mime,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "public, max-age=31536000, immutable",
        })
        .send(Buffer.from(media.data, "base64"));
    }),
  );
  router.post(
    "/admin/media",
    route(async (req, res) => {
      const b = record(req.body);
      const encoded = str(b.data, 5_600_000, true);
      const mime = str(b.mime, 30, true);
      const clean = await encodeUpload(encoded, mime);
      const id = randomUUID();
      await fileService(database).save(id, clean.bytes, clean.mime);
      res.status(201).json({ url: `/api/media/${id}` });
    }),
  );
  router.get(
    "/admin/management",
    route(async (_req, res) => {
      res.set("Cache-Control", "no-store").json(await store.read());
    }),
  );
  router.post(
    "/admin/management/import-articles",
    route(async (_req, res) => {
      await importLegacyArticles(store);
      res.json(await store.read());
    }),
  );
  router.put(
    "/admin/management/:collection/:id",
    route(async (req, res) => {
      const collection = String(req.params.collection);
      const id = str(req.params.id, 100, true);
      const body = record(req.body);
      const item = record(body.item);
      if (
        !["products", "coupons", "articles", "banners", "settings"].includes(
          collection,
        )
      )
        throw new StoreError("بخش پیدا نشد.", 404);
      await store.mutate(async (state) => {
        if (body.revision !== state.revision)
          throw new StoreError(
            "اطلاعات تغییر کرده است. ابتدا به‌روزرسانی کنید و دوباره ذخیره کنید.",
            409,
          );
        if (collection === "settings") {
          state.settings = {
            phone: str(item.phone, 40),
            email: str(item.email, 200),
            address: str(item.address, 1000),
            instagram: url(item.instagram),
            telegram: url(item.telegram),
            shippingEnabled: bool(item.shippingEnabled),
            shippingFee: num(item.shippingFee),
            freeShippingAbove: num(item.freeShippingAbove),
            returnWindowDays:
              item.returnWindowDays === undefined
                ? 7
                : num(item.returnWindowDays, 365),
            transactionalSmsEnabled:
              item.transactionalSmsEnabled === undefined
                ? false
                : bool(item.transactionalSmsEnabled),
          };
          if (
            (state.settings.phone && !contactPhone(state.settings.phone)) ||
            (state.settings.email && !contactEmail(state.settings.email))
          )
            throw new StoreError("تلفن یا ایمیل معتبر وارد کنید.");
          if (
            (state.settings.instagram &&
              !contactProfile(state.settings.instagram, "instagram")) ||
            (state.settings.telegram &&
              !contactProfile(state.settings.telegram, "telegram"))
          )
            throw new StoreError(
              "لینک مستقیم پروفایل اینستاگرام یا تلگرام را وارد کنید.",
            );
          return;
        }
        if (collection === "products") {
          const current = state.products.find((p) => p.id === id);
          if (
            current &&
            item.stock !== current.stock &&
            item.stockRevision !== current.stockRevision
          )
            throw new StoreError(
              "موجودی تغییر کرده است؛ اطلاعات را تازه کنید.",
              409,
            );
          let product;
          try {
            product = parseCatalogProduct({ ...item, id });
          } catch {
            throw new StoreError("مشخصات محصول کامل یا معتبر نیست.");
          }
          if (
            ![
              "سوپر نگین",
              "نگین",
              "شبه نگین",
              "سرگل",
              "پوشال",
              "رشته",
              "هدیه",
            ].includes(product.category) ||
            !Number.isFinite(product.weight) ||
            product.weight <= 0 ||
            product.name.length > 200 ||
            product.slug.length > 200 ||
            !/^[\p{L}\p{N}_-]+$/u.test(product.slug) ||
            product.short_description.length > 2000 ||
            (product.long_description?.length ?? 0) > 20000 ||
            [product.crocin, product.picrocrocin, product.safranal].some(
              (n) => n < 0 || n > 1000,
            )
          )
            throw new StoreError("مشخصات محصول نامعتبر است.");
          if (
            state.products.some((p) => p.slug === product.slug && p.id !== id)
          )
            throw new StoreError("این نشانی محصول قبلاً استفاده شده است.");
          const clean = {
            ...product,
            image_url: url(product.image_url, true),
            active: bool(item.active),
            stock: item.stock === null ? null : num(item.stock),
            stockRevision: current?.stockRevision ?? 0,
          };
          const index = state.products.findIndex((p) => p.id === id);
          if (index < 0) state.products.push(clean);
          else state.products[index] = clean;
          return;
        }
        if (collection === "coupons") {
          const code = str(item.code, 50, true).toUpperCase();
          const kind = item.kind;
          if (
            !/^[A-Z0-9_-]+$/.test(code) ||
            !["percent", "fixed"].includes(String(kind))
          )
            throw new StoreError(
              "کد تخفیف باید با حروف لاتین، عدد یا خط تیره باشد.",
            );
          if (state.coupons.some((c) => c.code === code && c.id !== id))
            throw new StoreError("کد تخفیف تکراری است.");
          const expiresAt = str(item.expiresAt, 40);
          if (expiresAt && !Number.isFinite(Date.parse(expiresAt)))
            throw new StoreError("تاریخ انقضا نامعتبر است.");
          const clean: Coupon = {
            id,
            code,
            kind: kind as Coupon["kind"],
            value: num(item.value, kind === "percent" ? 100 : 2_147_483_647),
            minimum: num(item.minimum),
            expiresAt,
            limit: num(item.limit),
            used: state.coupons.find((c) => c.id === id)?.used ?? 0,
            active: bool(item.active),
          };
          if (!clean.value)
            throw new StoreError("مقدار تخفیف باید بیشتر از صفر باشد.");
          const index = state.coupons.findIndex((c) => c.id === id);
          if (index < 0) state.coupons.push(clean);
          else state.coupons[index] = clean;
          return;
        }
        if (collection === "banners") {
          const clean: Banner = {
            id,
            image: url(item.image, true),
            title: str(item.title, 200, true),
            eyebrow: str(item.eyebrow, 200),
            subtitle: str(item.subtitle, 1000),
            link: url(item.link, true),
            active: bool(item.active),
          };
          const index = state.banners.findIndex((b) => b.id === id);
          if (index < 0) state.banners.push(clean);
          else state.banners[index] = clean;
          return;
        }
        if (state.articles === null) {
          state.articles = [];
          state.legacyArticlesEnabled = true;
        }
        const slug = str(item.slug, 200, true);
        if (
          !/^[\p{L}\p{N}_-]+$/u.test(slug) ||
          state.articles.some((a) => a.slug === slug && a.id !== id)
        )
          throw new StoreError("نشانی مقاله نامعتبر یا تکراری است.");
        const clean: ManagedArticle = {
          id,
          slug,
          title: str(item.title, 200, true),
          excerpt: str(item.excerpt, 2000, true),
          content: str(item.content, 100000, true),
          image_url: url(item.image_url, true),
          author: str(item.author, 120, true),
          category: str(item.category, 120, true),
          read_time: num(item.read_time, 999),
          published: bool(item.published),
          created_at:
            state.articles.find((a) => a.id === id)?.created_at ??
            new Date().toISOString(),
        };
        const index = state.articles.findIndex((a) => a.id === id);
        if (index < 0) state.articles.push(clean);
        else state.articles[index] = clean;
      });
      res.json(await store.read());
    }),
  );
  router.get(
    "/admin/orders",
    route(async (_req, res) => {
      const state = await store.read();
      const orders = await database
        .select()
        .from(ordersTable)
        .orderBy(desc(ordersTable.createdAt));
      res.set("Cache-Control", "no-store").json({
        orders: orders.map(
          ({ idempotencyKey: _k, requestFingerprint: _f, ...o }) => ({
            ...o,
            id: String(o.id),
            management: state.orderMeta[String(o.id)] ?? null,
          }),
        ),
      });
    }),
  );
  router.patch(
    "/admin/orders/:id/status",
    route(async (req, res) => {
      const id = Number(req.params.id);
      const b = record(req.body);
      if (
        !Number.isSafeInteger(id) ||
        id < 1 ||
        !ORDER_STATUSES.includes(b.status as OrderStatus)
      )
        throw new StoreError("وضعیت سفارش نامعتبر است.");
      const trackingCode =
        b.trackingCode === undefined ? undefined : str(b.trackingCode, 100);
      const order = await database.transaction(async (raw) => {
        const tx = raw as unknown as typeof database;
        return updateManagedOrder(
          {} as ManagementState,
          tx,
          id,
          b.status as OrderStatus,
          trackingCode,
          onOrderChange,
        );
      });
      if (afterOrderChange) await afterOrderChange().catch(() => {});
      res.json({ order });
    }),
  );
  return router;
}
