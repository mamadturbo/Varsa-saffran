import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import {
  buildPageMeta,
  publicOrigin,
  relativeMetaPath,
  replaceMetadata,
  type PageMeta,
} from "./src/lib/page-meta";
import {
  loadMetaArticles,
  loadMetaProducts,
  resolvePageMeta,
  type MetaDataConfig,
} from "./src/lib/meta-data";
import { articlePath, productPath } from "./src/lib/routes";
import { storefrontHeaders } from './security-policy';

export function isPageMetadataRequest(method: string, accept: string | undefined, pathname: string, base: string): boolean {
  if (!["GET", "HEAD"].includes(method)) return false;
  const acceptsPage = !accept || accept.split(',').some(part => ['text/html', '*/*'].includes(part.split(';')[0].trim().toLowerCase()));
  const route = relativeMetaPath(pathname, base);
  const apiPath = (value: string) => value === '/api' || value.startsWith('/api/');
  return acceptsPage && !apiPath(pathname) && !apiPath(route) && !/\.[a-z0-9]+$/i.test(route);
}

export function snapshotFileForPath(route: string): string {
  if (route === "/") return "index.html";
  const segments = route
    .replace(/^\//, "")
    .split("/")
    .map((segment) => decodeURIComponent(segment));
  for (const segment of segments) {
    if (
      !segment ||
      [".", ".."].includes(segment) ||
      /[\\/\x00-\x1f<>:"|?*]/.test(segment) ||
      /[. ]$/.test(segment) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment)
    )
      throw new Error("Unsafe snapshot path");
  }
  return `${segments.join("/")}/index.html`;
}
export function pageMetadataPlugin(): Plugin {
  let config: ResolvedConfig;
  let dataConfig: MetaDataConfig;
  return {
    name: "varsa-page-metadata",
    enforce: "post",
    configResolved(resolved) {
      config = resolved;
      dataConfig = {
        catalogSource: 'managed',
        apiUrl: process.env.METADATA_API_URL ?? (resolved.command === 'serve' ? process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:5000' : resolved.env.VITE_SITE_URL),
        siteUrl: resolved.env.VITE_SITE_URL,
        basePath: resolved.base,
      };
      publicOrigin(dataConfig.siteUrl);
    },
    transformIndexHtml: {
      order: "post",
      async handler(html, context) {
        if (config.command === "build")
          return replaceMetadata(html, buildPageMeta("/", dataConfig));
        const pathname = new URL(
          context.originalUrl ?? context.path,
          "http://metadata.local",
        ).pathname;
        return replaceMetadata(
          html,
          await resolvePageMeta(
            relativeMetaPath(pathname, config.base),
            dataConfig,
          ),
        );
      },
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url ?? "/", "http://metadata.local")
          .pathname;
        const route = relativeMetaPath(pathname, config.base);
        if (!isPageMetadataRequest(req.method ?? '', req.headers.accept, pathname, config.base)) {
          next();
          return;
        }
        try {
          const html = await readFile(
            path.resolve(config.root, config.build.outDir, "index.html"),
            "utf8",
          );
          const meta = await resolvePageMeta(route, dataConfig);
          // This handler ends HTML responses before Vite's static middleware;
          // preview.headers alone cannot protect these generated pages.
          for(const [name,value] of Object.entries(storefrontHeaders))res.setHeader(name,value);
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(
            req.method === "HEAD" ? undefined : replaceMetadata(html, meta),
          );
        } catch (error) {
          next(error);
        }
      });
    },
    generateBundle: {
      order: "post",
      async handler(_options, bundle) {
        const index = bundle["index.html"];
        if (
          !index ||
          index.type !== "asset" ||
          typeof index.source !== "string"
        )
          throw new Error("Missing storefront HTML output");
        const template = index.source;
        const manifest: { route: string; file: string }[] = [
          { route: "/", file: "index.html" },
        ];
        const warnings: string[] = [];
        const files = new Set<string>(["index.html"]);
        const emitPage = (
          meta: PageMeta,
          file = snapshotFileForPath(meta.path),
        ) => {
          if (files.has(file.toLowerCase()))
            throw new Error("Colliding metadata snapshot path");
          files.add(file.toLowerCase());
          this.emitFile({
            type: "asset",
            fileName: file,
            source: replaceMetadata(template, meta),
          });
          manifest.push({ route: meta.path, file });
        };
        for (const route of [
          "/shop",
          "/guide",
          "/journal",
          "/about",
          "/contact",
          "/admin",
          "/account",
        ])
          emitPage(buildPageMeta(route, dataConfig));
        emitPage(buildPageMeta("/not-found", dataConfig), "404.html");
        const [products, articles] = await Promise.allSettled([
          loadMetaProducts(dataConfig),
          loadMetaArticles(dataConfig),
        ]);
        const safeEmit = (meta: PageMeta) => {
          try {
            emitPage(meta);
          } catch {
            warnings.push(
              `Skipped unsafe or colliding metadata path: ${encodeURI(meta.path)}`,
            );
          }
        };
        if (products.status === "fulfilled")
          for (const product of products.value)
            safeEmit(
              buildPageMeta(productPath(product.slug), dataConfig, { product }),
            );
        else
          warnings.push(
            "Product metadata snapshots unavailable; check public catalog access and rebuild.",
          );
        if (articles.status === "fulfilled")
          for (const article of articles.value)
            safeEmit(
              buildPageMeta(articlePath(article.slug), dataConfig, { article }),
            );
        else
          warnings.push(
            "Article metadata snapshots unavailable; check public catalog access and rebuild.",
          );
        if (!dataConfig.siteUrl)
          warnings.push(
            "VITE_SITE_URL is unset: static canonical and relative social image URLs are omitted.",
          );
        for (const warning of warnings) this.warn(warning);
        if (warnings.length && process.env.SEO_REQUIRE_COMPLETE === "1")
          throw new Error(
            "Metadata snapshots incomplete; resolve the reported configuration/catalog issues.",
          );
        this.emitFile({
          type: "asset",
          fileName: "metadata-snapshots.json",
          source: JSON.stringify(
            {
              generatedAt: new Date().toISOString(),
              canonicalConfigured: Boolean(dataConfig.siteUrl),
              pages: manifest,
              warnings,
            },
            null,
            2,
          ),
        });
      },
    },
  };
}
