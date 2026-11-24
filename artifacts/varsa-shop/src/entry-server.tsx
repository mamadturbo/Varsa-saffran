import { renderToString } from "react-dom/server";
import App, { type PublicViews } from "./App";
import type { StorefrontBootstrap } from "./lib/page-context";
import { privateRoute, publicViewName, storefrontRoute } from "./lib/routes";
import { createSeoHandler } from "./http-seo";
import { HomePage } from "./pages/HomePage";
import { ShopPage } from "./pages/ShopPage";
import { GuidePage } from "./pages/GuidePage";
import { JournalPage } from "./pages/JournalPage";
import { ArticlePage } from "./pages/ArticlePage";
import { AboutPage } from "./pages/AboutPage";
import { ContactPage } from "./pages/ContactPage";
import { ProductRoute } from "./pages/ProductRoute";
import { NotFoundPage } from "./pages/NotFoundPage";

const views: PublicViews = {
  HomePage,
  ShopPage,
  GuidePage,
  JournalPage,
  ArticlePage,
  AboutPage,
  ContactPage,
  ProductRoute,
  NotFoundPage,
};

export function render(initial: StorefrontBootstrap, target: string) {
  if (privateRoute(storefrontRoute(initial.page.path))) return "";
  return renderToString(
    <App initial={initial} target={target} views={views} />,
  );
}

export function storefrontHandler(
  options: Omit<
    Parameters<typeof createSeoHandler>[0],
    "render" | "basePath" | "preloadLinks"
  > & {
    manifest?: Record<string, { file: string; imports?: string[] }>;
  },
) {
  const { manifest, ...handlerOptions } = options;
  return createSeoHandler({
    ...handlerOptions,
    render,
    basePath: import.meta.env.BASE_URL,
    preloadLinks: manifest
      ? (page) => {
          const view = publicViewName(page.path, page.status);
          if (!view) return "";
          const visited = new Set<string>();
          const links: string[] = [];
          const visit = (id: string) => {
            if (visited.has(id)) return;
            visited.add(id);
            const chunk = manifest[id];
            if (!chunk) return;
            if (/^assets\/[\w.-]+\.js$/.test(chunk.file))
              links.push(
                `<link rel="modulepreload" crossorigin href="${import.meta.env.BASE_URL}${chunk.file}">\n`,
              );
            chunk.imports?.forEach(visit);
          };
          visit(`src/pages/${view}.tsx`);
          return links.join("");
        }
      : undefined,
  });
}
