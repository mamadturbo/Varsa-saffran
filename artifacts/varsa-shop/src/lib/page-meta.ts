import type { CatalogProduct } from "@workspace/catalog";
import { articlePath, productPath } from "./routes";
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
}
export interface MetaConfig {
  siteUrl?: string;
  basePath?: string;
}
export const HOME_TITLE = "ورسا | فروشگاه زعفران";
export const HOME_DESCRIPTION =
  "محصولات زعفران ورسا، مشخصات هر محصول و راهنماهای انتخاب و استفاده از زعفران را ببینید.";
const staticPages: Record<string, [string, string]> = {
  "/": [HOME_TITLE, HOME_DESCRIPTION],
  "/shop": [
    "فروشگاه زعفران | ورسا",
    "محصولات زعفران ورسا را بر اساس دسته‌بندی، وزن، مشخصات و قیمت مقایسه و انتخاب کنید.",
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
    "داستان ورسا | ورسا",
    "با نام ورسا و داستان این فروشگاه زعفران آشنا شوید.",
  ],
  "/contact": [
    "تماس با ورسا",
    "راه‌های ارتباط با ورسا و فرم ارسال پرسش و پیام را ببینید.",
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
    unavailable?: boolean;
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
  if (Object.hasOwn(staticPages, path)) {
    const [title, description] = staticPages[path];
    result = {
      ...common,
      title,
      description,
      robots: path === "/admin" || path === "/account" ? "noindex,nofollow" : common.robots,
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
            product.short_description ||
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
  } else if (/^\/journal\/[^/]+$/.test(path)) {
    const article = data?.article;
    result = article
      ? {
          ...common,
          path: articlePath(article.slug),
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
  if (origin && result.robots === "index,follow")
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
    });
  }
  return result;
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
