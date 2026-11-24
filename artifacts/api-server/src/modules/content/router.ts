import { Router } from "express";
import { contactMessages } from "@workspace/db/schema";
import { normalizeIranMobile } from "@workspace/validation";
import type { ManagementStore } from "../../lib/management-store";
import type { Database } from "../catalog/repository";
import { StoreError } from "../../lib/management-store";
import { createCustomerAuth } from "../../lib/customer-auth";
import { clientNetwork } from "../../lib/admin-login-limit";
import type { ManagedArticle } from "@workspace/catalog";

export async function legacyArticles(): Promise<ManagedArticle[]> {
  const endpoint = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!endpoint || !key)
    throw new StoreError("اتصال به منبع مقالات قبلی تنظیم نشده است. تنظیمات SUPABASE_URL و SUPABASE_ANON_KEY سرور را بررسی کنید.", 503);
  const articles: ManagedArticle[] = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(
      `${endpoint.replace(/\/$/, "")}/rest/v1/articles?select=*&order=created_at.desc,id.asc&limit=1000&offset=${offset}`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) throw new StoreError("دریافت مجله انجام نشد.", 503);
    const rows = await response.json();
    if (
      !Array.isArray(rows) ||
      rows.some(
        (a) =>
          !a ||
          typeof a.id !== "string" ||
          typeof a.slug !== "string" ||
          typeof a.title !== "string" ||
          typeof a.content !== "string",
      )
    )
      throw new StoreError("اطلاعات مجله معتبر نیست.", 503);
    articles.push(...rows.map((a) => ({ ...a, published: a.published !== false })));
    if (rows.length < 1000) break;
  }
  return articles;
}
export function contentRouter(database: Database, store: ManagementStore) {
  const router = Router(),
    auth = createCustomerAuth(database);
  router.get("/articles", async (req, res, next) => {
    try {
      const state = await store.publicState(),
        managed = state.articles ?? [];
      let legacy: ManagedArticle[] = [];
      if (state.legacyArticlesEnabled) {
        try {
          legacy = await legacyArticles();
        } catch (error) {
          if (!managed.length) throw error;
          res.set("X-Varsa-Articles-Partial", "1");
        } // Preserve pre-import managed articles during a legacy outage.
      }
      const rows = [
        ...legacy.filter((a) => !managed.some((m) => m.slug === a.slug)),
        ...managed,
      ].filter((a) => a.published);
      res
        .set("Cache-Control", "no-store")
        .json(rows.sort((a, b) => b.created_at.localeCompare(a.created_at)));
    } catch (e) {
      next(e);
    }
  });
  router.post("/contact", async (req, res, next) => {
    try {
      const input = req.body;
      if (!input || typeof input !== "object")
        throw new StoreError("اطلاعات نامعتبر است.");
      const read = (key: string, max: number) => {
        const v = input[key];
        if (typeof v !== "string" || !v.trim() || v.length > max)
          throw new StoreError("اطلاعات فرم کامل یا معتبر نیست.");
        return v.trim();
      };
      const phone = normalizeIranMobile(input.phone);
      if (!phone) throw new StoreError("شماره موبایل معتبر وارد کنید.");
      const data = {
        name: read("name", 120),
        phone,
        subject: read("subject", 200),
        message: read("message", 5000),
      };
      await auth.limit(
        `contact:${clientNetwork(req.ip ?? req.socket.remoteAddress ?? "unknown")}`,
        60,
        3600,
      );
      await auth.limit(`contact-phone:${phone}`,5,3600);
      await auth.limit('contact-global',1000,3600);
      await database.insert(contactMessages).values(data);
      res.status(201).json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  return router;
}
