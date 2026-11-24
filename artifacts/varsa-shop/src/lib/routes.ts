export const PAGE_PATHS = {
  home: "/",
  shop: "/shop",
  guide: "/guide",
  journal: "/journal",
  about: "/about",
  contact: "/contact",
  admin: "/admin",
} as const;
export function pagePath(page: string): string {
  return Object.hasOwn(PAGE_PATHS, page)
    ? PAGE_PATHS[page as keyof typeof PAGE_PATHS]
    : "/not-found";
}
export const articlePath = (slug: string) =>
  `/journal/${encodeURIComponent(slug)}`;
export const productPath = (slug: string) =>
  `/products/${encodeURIComponent(slug)}`;
export const guidePath = (slug: string) => `/guide/${encodeURIComponent(slug)}`;

export const CHECKOUT_PATHS = {
  register: "/checkout/register",
  cart: "/checkout/cart",
  shipping: "/checkout/shipping",
  review: "/checkout/review",
} as const;
export type CheckoutStage = keyof typeof CHECKOUT_PATHS;

export const CHECKOUT_TITLES = {
  register: "ثبت‌نام یا ورود",
  cart: "سبد خرید",
  shipping: "اطلاعات ارسال",
  review: "بازبینی سفارش",
} satisfies Record<CheckoutStage, string>;

export const CATEGORY_SLUGS = {
  "سوپر نگین": "super-negin",
  "نگین": "negin",
  "شبه نگین": "semi-negin",
  "سرگل": "sargol",
  "پوشال": "pushal",
  "رشته": "bunch",
  "هدیه": "gift",
} as const;

export function categoryPath(category: string): string | undefined {
  if (Object.hasOwn(CATEGORY_SLUGS, category))
    return `/categories/${CATEGORY_SLUGS[category as keyof typeof CATEGORY_SLUGS]}`;
  return undefined;
}

export function categoryName(slug: string): string | undefined {
  return Object.entries(CATEGORY_SLUGS).find(([, value]) => value === slug)?.[0];
}
// The router decodes URI characters for matching. Read the raw segment and
// decode exactly once so literal percent signs and reserved characters survive.
export function lastPathSegment(pathname: string): string | null {
  const encoded = pathname.replace(/\/+$/, "").split("/").at(-1);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

export const isAssetPath = (path: string) =>
  /\.(?:html?|js|mjs|ts|css|map|png|jpe?g|webp|avif|svg|gif|ico|woff2?|mp4|pdf)$/i.test(path);

export function storefrontRoute(path: string) {
  const clean = path.replace(/\/+$/, "") || "/";
  if (isAssetPath(clean)) return { kind: "missing" } as const;
  switch (clean) {
    case "/": return { kind: "home" } as const;
    case "/shop": return { kind: "shop" } as const;
    case "/guide": return { kind: "guide" } as const;
    case "/journal": return { kind: "journal" } as const;
    case "/about": return { kind: "about" } as const;
    case "/contact": return { kind: "contact" } as const;
    case "/admin": return { kind: "admin" } as const;
    case "/account": return { kind: "account" } as const;
    case CHECKOUT_PATHS.register: return { kind: "checkout", stage: "register" } as const;
    case CHECKOUT_PATHS.cart: return { kind: "checkout", stage: "cart" } as const;
    case CHECKOUT_PATHS.shipping: return { kind: "checkout", stage: "shipping" } as const;
    case CHECKOUT_PATHS.review: return { kind: "checkout", stage: "review" } as const;
  }
  const slug = lastPathSegment(clean);
  if (slug && !/[\/\\\x00-\x1f\x7f]/.test(slug) && slug !== "." && slug !== "..") {
    if (/^\/products\/[^/]+$/.test(clean)) return { kind: "product", slug } as const;
    if (/^\/journal\/[^/]+$/.test(clean)) return { kind: "article", slug } as const;
    if (/^\/guide\/[^/]+$/.test(clean)) return { kind: "editorial", slug } as const;
    if (/^\/payment\/[1-9]\d*$/.test(clean)) return { kind: "payment", slug } as const;
    if (/^\/categories\/[^/]+$/.test(clean)) {
      const category = categoryName(slug);
      if (category) return { kind: "category", category } as const;
    }
  }
  return { kind: "missing" } as const;
}

export type StorefrontRoute = ReturnType<typeof storefrontRoute>;

const publicViews = {
  home: "HomePage",
  shop: "ShopPage",
  category: "ShopPage",
  guide: "GuidePage",
  journal: "JournalPage",
  article: "ArticlePage",
  editorial: "ArticlePage",
  about: "AboutPage",
  contact: "ContactPage",
  product: "ProductRoute",
  missing: "NotFoundPage",
  admin: null,
  account: null,
  checkout: null,
  payment: null,
} as const satisfies Record<StorefrontRoute["kind"], string | null>;

export function publicViewName(path: string, status: number) {
  if (status === 503) return null;
  if (status === 404) return "NotFoundPage";
  return publicViews[storefrontRoute(path).kind];
}

export function privateRoute(route: StorefrontRoute): boolean {
  return route.kind === "admin" || route.kind === "account" || route.kind === "checkout" || route.kind === "payment";
}
