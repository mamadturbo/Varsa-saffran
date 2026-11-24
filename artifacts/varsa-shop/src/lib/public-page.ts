import {
  parseStorefrontProduct,
  type Banner,
  type StoreSettings,
} from "@workspace/catalog";
import { storeContact } from "./contacts";
import { GUIDE_ARTICLES } from "./guide-articles";
import { buildPageMeta, type MetaConfig } from "./page-meta";
import {
  articlePath,
  categoryPath,
  privateRoute,
  productPath,
  storefrontRoute,
} from "./routes";
import type { Article, Product } from "./types";
import { readShopCategory } from "./shop-filter";

export interface PublicStore {
  banners: Banner[];
  settings: StoreSettings;
  categories?: string[];
}

export interface PublicPage {
  path: string;
  status: 200 | 404 | 503;
  products?: Product[] | null;
  articles?: Article[] | null;
  store?: PublicStore | null;
  product?: Product;
  article?: Article;
}

// These known legacy articles need editorial review before entering the index.
// Their published URLs and managed content remain available.
const articlesPendingReview = new Set([
  "how-to-identify-real-saffron",
  "brewing-saffron-secrets",
  "saffron-health-benefits",
]);

export function publicProducts(body: unknown): Product[] {
  if (!Array.isArray(body)) throw new Error("Invalid public catalog");
  return body
    .map(parseStorefrontProduct)
    .filter((p) => p.active !== false);
}

function publicArticles(body: unknown): Article[] {
  if (!Array.isArray(body)) throw new Error("Invalid public articles");
  return body
    .filter((a) => a?.published !== false)
    .map((a) => {
      if (
        !a ||
        ![
          a.id,
          a.slug,
          a.title,
          a.excerpt,
          a.content,
          a.image_url,
          a.author,
          a.category,
          a.created_at,
        ].every((value) => typeof value === "string")
      )
        throw new Error("Invalid public article");
      return {
        id: a.id,
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        content: a.content,
        image_url: a.image_url,
        author: a.author,
        category: a.category,
        read_time: Number.isFinite(a.read_time) ? a.read_time : 0,
        created_at: a.created_at,
      };
    });
}

function publicStore(body: unknown): PublicStore {
  const { banners, settings, categories } = body as PublicStore;
  if (!Array.isArray(banners) || !settings)
    throw new Error("Invalid public store");
  return {
    banners: banners
      .filter((banner) => banner.active)
      .map((banner) => ({
        id: banner.id,
        image: banner.image,
        eyebrow: banner.eyebrow,
        title: banner.title,
        subtitle: banner.subtitle,
        link: banner.link,
        active: true,
      })),
    categories: Array.isArray(categories)
      ? categories.filter(
          (value) => typeof value === "string" && categoryPath(value),
        )
      : undefined,
    settings: {
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
      instagram: settings.instagram,
      telegram: settings.telegram,
      shippingEnabled: settings.shippingEnabled === true,
      shippingFee: settings.shippingFee,
      freeShippingAbove: settings.freeShippingAbove,
      returnWindowDays: settings.returnWindowDays,
    },
  };
}

export function publicApi(origin = "") {
  // Concurrent HTML requests for the same resource can share an in-flight read.
  const pending = new Map<
    string,
    Promise<{ body: unknown; partial: boolean }>
  >();
  const read = (path: string) => {
    const existing = pending.get(path);
    if (existing) return existing;
    const request = fetch(origin + path, {
      signal: AbortSignal.timeout(5_000),
      credentials: "omit",
      redirect: "error",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Public API unavailable");
        return {
          body: (await response.json()) as unknown,
          partial: response.headers.get("X-Varsa-Articles-Partial") === "1",
        };
      })
      .finally(() => pending.delete(path));
    pending.set(path, request);
    return request;
  };
  return {
    products: () =>
      read("/api/store/products").then(({ body }) => publicProducts(body)),
    articles: () =>
      read("/api/articles").then(({ body, partial }) => ({
        rows: publicArticles(body),
        partial,
      })),
    store: () =>
      read("/api/store/content").then(({ body }) => publicStore(body)),
  };
}

export type PublicApi = ReturnType<typeof publicApi>;
export const browserPublicApi = publicApi();

export async function readPublicPage(
  path: string,
  api: PublicApi,
): Promise<PublicPage> {
  const route = storefrontRoute(path);
  const result: PublicPage = { path, status: 200 };
  const kind = route.kind;
  if (kind === "missing") return { ...result, status: 404 };
  if (privateRoute(route)) return result;

  const [products, journal, store] = await Promise.all([
    ["home", "shop", "product", "category", "guide", "editorial"].includes(kind)
      ? api.products().catch(() => null)
      : undefined,
    ["home", "journal", "article"].includes(kind)
      ? api.articles().catch(() => null)
      : undefined,
    api.store().catch(() => null),
  ]);
  const articles = journal == null ? journal : journal.rows;
  result.products = products;
  result.articles = articles?.map((a) => ({ ...a, content: "" })) ?? articles;
  result.store = store;

  if (
    (products === null && ["shop", "product", "category"].includes(kind)) ||
    (articles === null && kind === "article")
  ) {
    result.status = 503;
  } else if (route.kind === "product") {
    result.product = products?.find((p) => p.slug === route.slug);
    if (!result.product) result.status = 404;
  } else if (route.kind === "article") {
    result.article = articles?.find((a) => a.slug === route.slug);
    if (!result.article) result.status = journal?.partial ? 503 : 404;
    // Only the selected article body is needed in the hydration payload.
    result.articles = undefined;
  } else if (route.kind === "editorial") {
    result.article = GUIDE_ARTICLES.find((a) => a.slug === route.slug);
    if (!result.article) result.status = 404;
  } else if (
    route.kind === "category" &&
    !products?.some((p) => p.category === route.category)
  ) {
    result.status = 404;
  }
  return result;
}

export function pageMetadata(data: PublicPage, config: MetaConfig, search = "") {
  const route = storefrontRoute(data.path);
  const query = new URLSearchParams(search);
  const facet = (route.kind === "shop" || route.kind === "category") && (query.has("weight") || query.has("unit"));
  return buildPageMeta(data.path, config, {
    product: data.product,
    article: data.article,
    category: route.kind === "category" ? route.category : undefined,
    categoryExists: Boolean(
      data.product && categoryPath(data.product.category),
    ),
    unavailable: data.status === 503,
    contact: storeContact(data.store?.settings),
    noindex:
      data.status !== 200 ||
      (route.kind === "shop" && (!data.products?.length || Boolean(readShopCategory(search)))) ||
      facet ||
      (route.kind === "article" && articlesPendingReview.has(route.slug)),
  });
}

export async function sitemapPaths(api: PublicApi) {
  const [products, journal] = await Promise.all([
    api.products(),
    api.articles(),
  ]);
  if (journal.partial) throw new Error("Article sitemap would be incomplete");
  const paths = [
    "/",
    "/guide",
    "/journal",
    "/about",
    "/contact",
    ...GUIDE_ARTICLES.map((a) => a.path),
  ];
  if (products.length) paths.push("/shop");
  for (const p of products) {
    const product = productPath(p.slug);
    const category = categoryPath(p.category);
    if (storefrontRoute(product).kind === "product") paths.push(product);
    if (category) paths.push(category);
  }
  for (const a of journal.rows) {
    const article = articlePath(a.slug);
    if (
      storefrontRoute(article).kind === "article" &&
      !articlesPendingReview.has(a.slug)
    )
      paths.push(article);
  }
  return [...new Set(paths)];
}
