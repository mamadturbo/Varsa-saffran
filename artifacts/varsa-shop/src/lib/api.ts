import { customFetch } from "@workspace/api-client-react";
import { parseCatalogProduct } from "@workspace/catalog";
import { normalizeIranMobile, MOBILE_PHONE_ERROR } from "@workspace/validation";
import type { Article, ContactMessage, Product } from "./types";

export async function fetchProducts(): Promise<Product[]> {
  const rows = await customFetch<Product[]>("/api/store/products", {
    signal: AbortSignal.timeout(20000),
  });
  return rows.map(parseCatalogProduct);
}

export async function fetchFeaturedProducts(): Promise<Product[]> {
  const products = await fetchProducts();
  return products.filter((product) => product.is_featured);
}

export async function fetchArticles(): Promise<Article[]> {
  return customFetch<Article[]>("/api/articles", {
    signal: AbortSignal.timeout(20000),
  });
}

export async function fetchArticleBySlug(
  slug: string,
): Promise<Article | null> {
  return (await fetchArticles()).find((a) => a.slug === slug) ?? null;
}

export async function submitContact(msg: ContactMessage): Promise<void> {
  const phone = normalizeIranMobile(msg.phone);
  if (!phone) throw new Error(MOBILE_PHONE_ERROR);
  await customFetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...msg, phone }),
  });
}
