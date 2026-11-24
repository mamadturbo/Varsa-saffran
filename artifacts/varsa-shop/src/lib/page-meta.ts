import type { StorefrontProduct as CatalogProduct } from "@workspace/catalog";
import { articlePath, categoryPath, CHECKOUT_TITLES, guidePath, productPath, storefrontRoute } from "./routes";
import { categoryGuide } from "./buying-guide";
import type { ContactConfig } from "@workspace/validation";
import { VARSA } from "./brand-identity";
import { productSummary } from "./representative-products";
import {
  buildProductJsonLd,
  serializeJsonLd,
  type ProductJsonLd,
} from "./product-jsonld";

export interface MetaArticle {
  slug: string;
  title: string;
  excerpt: string;
  image_url: string;
  author?: string;
  citationUrls?: readonly string[];
}
export interface PageMeta {
  title: string;
  description: string;
  path: string;
  robots: string;
  type: "website" | "article";
  image?: string;
  imageAlt?: string;
  canonical?: string;
  structuredData?: ProductJsonLd;
  entities?: Record<string, unknown>[];
}
export interface MetaConfig {
  siteUrl?: string;
  basePath?: string;
  indexable?: boolean;
}
export const HOME_TITLE = `${VARSA.name} | ${VARSA.englishName}`;
export const HOME_DESCRIPTION =
  `${VARSA.description} مشخصات بسته‌ها و راهنماهای انتخاب و استفاده از زعفران را ببینید.`;
const staticPages: Record<string, [string, string]> = {
  "/": [HOME_TITLE, HOME_DESCRIPTION],
  "/shop": [
    "خرید زعفران و مقایسه قیمت بسته‌ها | ورسا",
    "قیمت و وزن بسته‌های زعفران ورسا را مقایسه کنید و مشخصات هر محصول را پیش از خرید ببینید.",
  ],
  "/guide": [
    "راهنمای انتخاب زعفران | ورسا",
    "تفاوت برش‌های زعفران و دسته‌های فعلی ورسا را با وزن‌ها و بازه قیمت هر بسته مقایسه کنید و برای مصرف یا هدیه انتخاب کنید.",
  ],
  "/journal": [
    "مجله دلگشا | ورسا",
    "راهنماهای انتخاب، نگهداری و استفاده از زعفران را در مجله دلگشای ورسا بخوانید.",
  ],
  "/about": [
    `دربارهٔ ${VARSA.name} | ${VARSA.englishName}`,
    `${VARSA.description} ${VARSA.sellerDescription}`,
  ],
  "/contact": [
    `تماس با ${VARSA.name}`,
    "شمارهٔ پشتیبانی زعفران ورسا، فرم تماس و مسیر پیگیری سفارش و درخواست مرجوعی را ببینید.",
  ],
  "/admin": ["مدیریت فروشگاه | ورسا", "پنل مدیریت فروشگاه ورسا."],
  "/account": ["حساب من | ورسا", "پیگیری سفارش‌ها و مدیریت حساب مشتری ورسا."],
};
export const cleanMetaText = (value: string, limit = 180) =>
  value.replace(/\s+/g, " ").trim().slice(0, limit);
export function publicOrigin(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "VITE_SITE_URL must be an HTTP(S) origin without a path or credentials.",
    );
  return url.origin;
}
export function basePrefix(base = "/") {
  return `/${base}`.replace(/\/+/g, "/").replace(/\/$/, "");
}
export function relativeMetaPath(pathname: string, base = "/") {
  const prefix = basePrefix(base);
  return pathname === prefix
    ? "/"
    : pathname.startsWith(`${prefix}/`)
      ? pathname.slice(prefix.length)
      : "/not-found";
}
function absoluteImage(value: string, origin?: string): string | undefined {
  try {
    const url = new URL(value, origin);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function buildPageMeta(
  path: string,
  config: MetaConfig = {},
  data?: {
    product?: CatalogProduct | null;
    article?: MetaArticle | null;
    category?: string;
    unavailable?: boolean;
    noindex?: boolean;
    categoryExists?: boolean;
    contact?: ContactConfig;
  },
): PageMeta {
  path = path.replace(/\/+$/, "") || "/";
  const origin = publicOrigin(config.siteUrl);
  const prefix = basePrefix(config.basePath);
  const common = {
    path,
    type: "website" as const,
    robots: "index,follow",
    imageAlt: "زعفران ورسا",
    image: origin ? `${origin}${prefix}/photos/saffron-flowers-1600.webp` : undefined,
  };
  let result: PageMeta;
  const route = storefrontRoute(path);
  if (route.kind === "checkout") {
    result = {
      ...common,
      title: `${CHECKOUT_TITLES[route.stage]} | ورسا`,
      description: "تکمیل سفارش فروشگاه ورسا.",
      robots: "noindex,nofollow",
    };
  } else if (Object.hasOwn(staticPages, path)) {
    const [title, description] = staticPages[path];
    result = {
      ...common,
      title,
      description,
      robots: path === "/admin" || path === "/account" ? "noindex,nofollow" : common.robots,
    };
  } else if (data?.category && categoryPath(data.category)) {
    result = {
      ...common,
      path: categoryPath(data.category)!,
      title: data.category === "هدیه" ? "بسته‌های هدیه زعفران | ورسا" : `خرید زعفران ${data.category} | ورسا`,
      description: cleanMetaText(`وزن و قیمت بسته‌های ${data.category} ورسا را مقایسه کنید. ${categoryGuide(data.category).text}`),
    };
  } else if (/^\/payment\/[^/]+$/.test(path)) {
    result = { ...common, title: 'پرداخت و پیگیری رسید | ورسا', description: 'پرداخت سفارش و پیگیری بررسی رسید.', robots: 'noindex,nofollow' };
  } else if (/^\/products\/[^/]+$/.test(path)) {
    const product = data?.product;
    result = product
      ? {
          ...common,
          path: productPath(product.slug),
          title: `${cleanMetaText(product.name, 100)} | ورسا`,
          description: cleanMetaText(
            productSummary(product) ||
              `مشخصات، وزن و قیمت ${product.name} را در فروشگاه ورسا ببینید.`,
          ),
          image: absoluteImage(product.image_url, origin),
          imageAlt: cleanMetaText(product.name, 100),
        }
      : {
          ...common,
          title: data ? "محصول در دسترس نیست | ورسا" : "محصول زعفران | ورسا",
          description: "مشخصات محصول زعفران ورسا.",
          robots: data ? "noindex,follow" : common.robots,
        };
  } else if (/^\/(?:journal|guide)\/[^/]+$/.test(path)) {
    const article = data?.article;
    result = article
      ? {
          ...common,
          path: path.startsWith("/guide/") ? guidePath(article.slug) : articlePath(article.slug),
          title: `${cleanMetaText(article.title, 100)} | ورسا`,
          description: cleanMetaText(article.excerpt),
          type: "article",
          image: absoluteImage(article.image_url, origin),
          imageAlt: cleanMetaText(article.title, 100),
        }
      : {
          ...common,
          title: data ? "مقاله در دسترس نیست | ورسا" : "مجله دلگشا | ورسا",
          description: "راهنماهای زعفران در مجله دلگشای ورسا.",
          robots: data ? "noindex,follow" : common.robots,
        };
  } else
    result = {
      ...common,
      title: "صفحه پیدا نشد | ورسا",
      description: "این آدرس در سایت ورسا وجود ندارد.",
      robots: "noindex,follow",
      image: undefined,
    };
  if (data?.unavailable) {
    result.title = "صفحه موقتاً در دسترس نیست | ورسا";
    result.description = "برای دیدن این صفحه کمی بعد دوباره تلاش کنید.";
  }
  if (data?.noindex || data?.unavailable) result.robots = "noindex,follow";
  if (origin && result.robots === "index,follow" && config.indexable !== false)
    result.canonical = `${origin}${prefix}${result.path}`;
  if (
    /^\/products\/[^/]+$/.test(path) &&
    data?.product &&
    result.robots === "index,follow"
  ) {
    result.structuredData = buildProductJsonLd(data.product, {
      url: result.canonical,
      image: result.image,
      description: result.description,
      sellerId: result.canonical ? `${origin}${prefix}/#organization` : undefined,
    });
  }
  if (config.indexable === false && result.robots === "index,follow") result.robots = "noindex,follow";
  if (result.canonical && data && result.robots === "index,follow") {
    const site = `${origin}${prefix}/`;
    const organization = `${site}#organization`;
    const publisher = { "@type": "Organization", "@id": organization, name: VARSA.name };
    const entity = (type: string, fields: Record<string, unknown>) =>
      ({ "@context": "https://schema.org", "@type": type, ...fields });
    if (path === "/") {
      const contact = data.contact;
      const sameAs = [contact?.instagram, contact?.telegram].filter(Boolean);
      result.entities = [
        entity("Organization", {
          "@id": organization,
          name: VARSA.name,
          alternateName: [VARSA.englishName, VARSA.shortName],
          url: site,
          description: VARSA.description,
          logo: `${site}brand/logo-gold.png`,
          contactPoint: { "@type": "ContactPoint", url: `${site}contact`, contactType: "customer support" },
          ...(contact?.phone ? { telephone: contact.phone.href.slice(4) } : {}),
          ...(contact?.email ? { email: contact.email.label } : {}),
          ...(sameAs.length ? { sameAs } : {}),
        }),
        entity("WebSite", { "@id": `${site}#website`, name: VARSA.name, alternateName: VARSA.englishName, url: site, inLanguage: "fa-IR", publisher: { "@id": organization } }),
      ];
    } else if (path === "/about" || path === "/contact") {
      result.entities = [entity(path === "/about" ? "AboutPage" : "ContactPage", {
        "@id": `${result.canonical}#webpage`,
        url: result.canonical,
        name: result.title,
        description: result.description,
        inLanguage: "fa-IR",
        about: { "@id": organization },
        isPartOf: { "@id": `${site}#website` },
      })];
    } else {
      const items = pageBreadcrumbs(result.path, data);
      if (items.length) result.entities = [entity("BreadcrumbList", {
        itemListElement: items.map(([name, itemPath], i) => ({
          "@type": "ListItem", position: i + 1, name, item: `${origin}${prefix}${itemPath}`,
        })),
      })];
      if (data.article) {
        (result.entities ??= []).push(entity("Article", {
          "@id": `${result.canonical}#article`, url: result.canonical, mainEntityOfPage: result.canonical,
          headline: data.article.title, description: result.description, inLanguage: "fa-IR",
          publisher,
          ...(result.image ? { image: [result.image] } : {}),
          ...(data.article.citationUrls?.length ? { citation: data.article.citationUrls } : {}),
          ...([VARSA.name, VARSA.shortName].some(name => name === data.article?.author?.trim())
            ? { author: publisher } : {}),
        }));
      }
    }
  }
  return result;
}

type Breadcrumb = [name: string, path: string];
export function pageBreadcrumbs(path: string, data: {
  product?: CatalogProduct | null;
  article?: MetaArticle | null;
  category?: string;
  categoryExists?: boolean;
}): Breadcrumb[] {
  const home: Breadcrumb = ["خانه", "/"];
  const shop: Breadcrumb = ["فروشگاه", "/shop"];
  if (data.product) {
    const category = categoryPath(data.product.category);
    const crumbs = [home, shop];
    if (category && data.categoryExists) crumbs.push([data.product.category, category]);
    return [...crumbs, [data.product.name, productPath(data.product.slug)]];
  }
  if (data.category && categoryPath(data.category)) return [home, shop, [data.category, path]];
  if (data.article && path.startsWith("/guide/"))
    return [home, ["راهنمای انتخاب زعفران", "/guide"], [data.article.title, path]];
  if (data.article) return [home, ["مجله دلگشا", "/journal"], [data.article.title, path]];
  return [];
}
export interface HeadTag {
  tag: "title" | "meta" | "link" | "script";
  attrs?: Record<string, string>;
  text?: string;
}
export function metadataTags(meta: PageMeta): HeadTag[] {
  const tags: HeadTag[] = [{ tag: "title", text: meta.title }];
  const add = (key: "name" | "property", name: string, content: string) =>
    tags.push({ tag: "meta", attrs: { [key]: name, content } });
  add("name", "description", meta.description);
  add("name", "robots", meta.robots);
  add("property", "og:site_name", "ورسا");
  add("property", "og:locale", "fa_IR");
  add("property", "og:type", meta.type);
  add("property", "og:title", meta.title);
  add("property", "og:description", meta.description);
  add("name", "twitter:card", meta.image ? "summary_large_image" : "summary");
  add("name", "twitter:title", meta.title);
  add("name", "twitter:description", meta.description);
  if (meta.canonical) {
    tags.push({
      tag: "link",
      attrs: { rel: "canonical", href: meta.canonical },
    });
    add("property", "og:url", meta.canonical);
  }
  if (meta.image) {
    add("property", "og:image", meta.image);
    add("property", "og:image:alt", meta.imageAlt ?? "ورسا");
    add("name", "twitter:image", meta.image);
    add("name", "twitter:image:alt", meta.imageAlt ?? "ورسا");
  }
  if (meta.structuredData)
    tags.push({
      tag: "script",
      attrs: { type: "application/ld+json", id: "varsa-product-jsonld" },
      text: serializeJsonLd(meta.structuredData),
    });
  for (const entity of meta.entities ?? []) tags.push({
    tag: "script", attrs: { type: "application/ld+json" }, text: serializeJsonLd(entity),
  });
  return tags;
}
export function renderMetadata(meta: PageMeta): string {
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char]!,
    );
  return metadataTags(meta)
    .map((item) => {
      const attrs = Object.entries(item.attrs ?? {})
        .map(([key, value]) => ` ${key}="${escape(value)}"`)
        .join("");
      const content =
        item.tag === "script"
          ? `${item.text ?? ""}</script>`
          : item.tag === "title"
            ? `${escape(item.text ?? "")}</title>`
            : "";
      return `<${item.tag} data-varsa-meta${attrs}>${content}`;
    })
    .join("\n");
}
export function replaceMetadata(html: string, meta: PageMeta) {
  const block = `<!-- varsa-meta:start -->\n${renderMetadata(meta)}\n<!-- varsa-meta:end -->`;
  if (!html.includes("<!-- varsa-meta:start -->"))
    throw new Error("Missing metadata template markers");
  return html.replace(
    /<!-- varsa-meta:start -->[\s\S]*?<!-- varsa-meta:end -->/,
    () => block,
  );
}
