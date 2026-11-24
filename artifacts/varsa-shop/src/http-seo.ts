import type { IncomingMessage, ServerResponse } from "node:http";
import {
  basePrefix,
  publicOrigin,
  relativeMetaPath,
  replaceMetadata,
  type MetaConfig,
} from "./lib/page-meta";
import {
  pageMetadata,
  publicApi,
  readPublicPage,
  sitemapPaths,
} from "./lib/public-page";
import { isAssetPath, storefrontRoute } from "./lib/routes";
import { serializeJsonLd } from "./lib/product-jsonld";
import { readShopCategory, shopListingHref } from "./lib/shop-filter";
import type { StorefrontBootstrap } from "./lib/page-context";

export function isPageMetadataRequest(
  method: string,
  accept: string | undefined,
  pathname: string,
  base: string,
): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  const path = relativeMetaPath(pathname, base);
  if (/^\/api(?:\/|$)/.test(path) || /^\/api(?:\/|$)/.test(pathname))
    return false;
  if (["/robots.txt", "/sitemap.xml", "/index.html"].includes(path))
    return true;
  if (isAssetPath(path)) return false;
  const acceptsPage =
    !accept ||
    accept
      .split(",")
      .some((item) =>
        ["text/html", "application/xhtml+xml", "*/*"].includes(
          item.split(";")[0].trim().toLowerCase(),
        ),
      );
  return (
    acceptsPage &&
    !/^\/(?:@|__|node_modules\/|src\/)/.test(path) &&
    (storefrontRoute(path).kind !== "missing" || !/\.[a-z0-9]+$/i.test(path))
  );
}

export function indexingConfig(
  siteUrl: string | undefined,
  requestedIndexing: boolean,
  host?: string,
): MetaConfig {
  const origin = publicOrigin(siteUrl);
  if (requestedIndexing && !origin?.startsWith("https://"))
    throw new Error("SEO_INDEXING=1 requires an HTTPS SEO_SITE_URL.");
  return {
    siteUrl: origin,
    indexable: Boolean(
      requestedIndexing &&
      origin &&
      host?.toLowerCase() === new URL(origin).host,
    ),
  };
}

export function robotsText(config: MetaConfig): string {
  if (!config.indexable) return "User-agent: *\nDisallow: /\n";
  const prefix = basePrefix(config.basePath);
  return [
    "User-agent: *",
    "Disallow: /api/",
    "Allow: /api/media/",
    "",
    "User-agent: GPTBot",
    "User-agent: ClaudeBot",
    "User-agent: Google-Extended",
    "Disallow: /",
    "",
    `Sitemap: ${config.siteUrl}${prefix}/sitemap.xml`,
    "",
  ].join("\n");
}

const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character]!,
  );

export function sitemapXml(paths: string[], config: MetaConfig): string {
  const root = config.siteUrl + basePrefix(config.basePath);
  const urls = paths.map(
    (path) => `  <url><loc>${escapeXml(root + path)}</loc></url>`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

function inject(template: string, marker: string, value: string) {
  if (!template.includes(marker))
    throw new Error("Missing storefront template marker");
  return template.replace(marker, () => value);
}

interface SeoServerOptions {
  siteUrl?: string;
  indexable?: boolean;
  basePath?: string;
  apiOrigin: string;
  template: (target: string) => Promise<string>;
  render: (initial: StorefrontBootstrap, target: string) => string;
  preloadLinks?: (page: StorefrontBootstrap["page"]) => string;
  report?: (error: unknown) => void;
  headers?: Record<string, string>;
}

export function createSeoHandler(options: SeoServerOptions) {
  indexingConfig(options.siteUrl, options.indexable === true);
  const upstream = new URL(options.apiOrigin);
  if (
    !["http:", "https:"].includes(upstream.protocol) ||
    upstream.origin !== options.apiOrigin
  )
    throw new Error("The public API target must be an HTTP(S) origin.");
  const api = publicApi(upstream.origin);
  const prefix = basePrefix(options.basePath);
  return async function handle(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) {
    const target = req.url ?? "/";
    if (!target.startsWith("/") || target.startsWith("//") || !req.method)
      return next();
    const url = new URL("http://storefront.invalid" + target);
    const path = relativeMetaPath(url.pathname, options.basePath);
    if (
      !isPageMetadataRequest(
        req.method,
        req.headers.accept,
        url.pathname,
        options.basePath ?? "/",
      )
    )
      return next();

    const config = {
      ...indexingConfig(
        options.siteUrl,
        options.indexable === true,
        req.headers.host,
      ),
      basePath: options.basePath,
    };
    const send = (status: number, type: string, body: string) => {
      res.statusCode = status;
      res.setHeader("Content-Type", `${type}; charset=utf-8`);
      res.setHeader("Cache-Control", "no-store");
      if (status === 503) res.setHeader("Retry-After", "60");
      res.end(req.method === "HEAD" ? undefined : body);
    };
    const redirect = (location: string, search = url.search) => {
      res.statusCode = 308;
      res.setHeader("Location", location + search);
      res.setHeader("Cache-Control", "no-store");
      res.end();
    };

    for (const [name, value] of Object.entries(options.headers ?? {}))
      res.setHeader(name, value);
    if (!config.indexable) res.setHeader("X-Robots-Tag", "noindex, follow");
    try {
      if (path === "/robots.txt")
        return send(200, "text/plain", robotsText(config));
      if (path === "/sitemap.xml") {
        if (!config.indexable)
          return send(404, "text/plain", "Sitemap unavailable");
        return send(
          200,
          "application/xml",
          sitemapXml(await sitemapPaths(api), config),
        );
      }
      if (path === "/index.html" || (prefix && url.pathname === prefix))
        return redirect(`${prefix}/`);
      const page = await readPublicPage(path, api);
      if (storefrontRoute(path).kind === "shop" && page.status === 200) {
        const category = readShopCategory(url.search);
        if (
          category &&
          page.products?.some((product) => product.category === category)
        ) {
          const listing = shopListingHref(category, url.search);
          if (listing.startsWith("/categories/"))
            return redirect(prefix + listing, "");
        }
      }
      const meta = pageMetadata(page, config, url.search);
      if (page.status === 200 && meta.path !== path)
        return redirect(prefix + meta.path);
      if (meta.robots.startsWith("noindex"))
        res.setHeader("X-Robots-Tag", meta.robots);
      const initial = { page, config };
      const template = await options.template(target);
      const links = options.preloadLinks?.(page) ?? "";
      const html = replaceMetadata(
        links ? inject(template, "</head>", links + "</head>") : template,
        meta,
      );
      const body = options.render(initial, target);
      const state = `<script type="application/json" id="varsa-page-data">${serializeJsonLd(initial)}</script>`;
      return send(
        page.status,
        "text/html",
        inject(
          inject(html, "<!--varsa-app-->", body),
          "<!--varsa-data-->",
          state,
        ),
      );
    } catch (error) {
      options.report?.(error);
      res.setHeader("X-Robots-Tag", "noindex, follow");
      return send(503, "text/plain", "صفحه موقتاً در دسترس نیست.");
    }
  };
}
