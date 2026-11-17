import {
  getRestoredCatalog,
  parseCatalogProduct,
  type CatalogProduct,
} from "@workspace/catalog";
import { buildPageMeta, type MetaArticle, type MetaConfig } from "./page-meta";
import { lastPathSegment } from "./routes";
export interface MetaDataConfig extends MetaConfig {
  catalogSource?: "restored" | "database" | "managed";
  apiUrl?: string;
  fetch?: typeof fetch;
}
export async function loadMetaArticles(
  config: MetaDataConfig,
): Promise<MetaArticle[]> {
  const response = await (config.fetch ?? fetch)(
    `${config.apiUrl ?? ""}/api/articles`,
    { signal: AbortSignal.timeout(10000), cache: "no-store" },
  );
  if (!response.ok) throw new Error("Article API unavailable");
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error("Invalid article catalog");
  return rows.map((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      !["slug", "title", "excerpt", "image_url"].every(
        (key) => typeof row[key] === "string" && row[key].trim(),
      )
    )
      throw new Error("Invalid article metadata");
    return {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      image_url: row.image_url,
    };
  });
}
export async function loadMetaProducts(
  config: MetaDataConfig,
): Promise<CatalogProduct[]> {
  // Explicit historical fixture support; live build/browser always selects managed.
  if (config.catalogSource === "restored")
    return getRestoredCatalog(config.basePath);
  const response = await (config.fetch ?? fetch)(
    `${config.apiUrl ?? ""}/api/store/products`,
    { signal: AbortSignal.timeout(10000), cache: "no-store" },
  );
  if (!response.ok) throw new Error("Catalog API unavailable");
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error("Invalid catalog");
  return rows.map(parseCatalogProduct);
}
export async function resolvePageMeta(path: string, config: MetaDataConfig) {
  const slug = lastPathSegment(path);
  try {
    if (/^\/products\/[^/]+\/?$/.test(path))
      return buildPageMeta(path, config, {
        product: slug
          ? ((await loadMetaProducts(config)).find(
              (item) => item.slug === slug,
            ) ?? null)
          : null,
      });
    if (/^\/journal\/[^/]+\/?$/.test(path))
      return buildPageMeta(path, config, {
        article: slug
          ? ((await loadMetaArticles(config)).find(
              (item) => item.slug === slug,
            ) ?? null)
          : null,
      });
    return buildPageMeta(path, config);
  } catch {
    return buildPageMeta(path, config, { unavailable: true });
  }
}
