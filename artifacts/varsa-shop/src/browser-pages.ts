import { lazy } from "react";
import type { PublicViews } from "./App";
import type { PublicPage } from "./lib/public-page";
import { publicViewName } from "./lib/routes";

const loaders = {
  HomePage: () => import("@/pages/HomePage").then((m) => m.HomePage),
  ShopPage: () => import("@/pages/ShopPage").then((m) => m.ShopPage),
  GuidePage: () => import("@/pages/GuidePage").then((m) => m.GuidePage),
  JournalPage: () => import("@/pages/JournalPage").then((m) => m.JournalPage),
  ArticlePage: () => import("@/pages/ArticlePage").then((m) => m.ArticlePage),
  AboutPage: () => import("@/pages/AboutPage").then((m) => m.AboutPage),
  ContactPage: () => import("@/pages/ContactPage").then((m) => m.ContactPage),
  ProductRoute: () =>
    import("@/pages/ProductRoute").then((m) => m.ProductRoute),
  NotFoundPage: () =>
    import("@/pages/NotFoundPage").then((m) => m.NotFoundPage),
};

function lazyView<T extends React.ComponentType<any>>(load: () => Promise<T>) {
  return lazy(() => load().then((view) => ({ default: view })));
}

const browserViews: PublicViews = {
  HomePage: lazyView(loaders.HomePage),
  ShopPage: lazyView(loaders.ShopPage),
  GuidePage: lazyView(loaders.GuidePage),
  JournalPage: lazyView(loaders.JournalPage),
  ArticlePage: lazyView(loaders.ArticlePage),
  AboutPage: lazyView(loaders.AboutPage),
  ContactPage: lazyView(loaders.ContactPage),
  ProductRoute: lazyView(loaders.ProductRoute),
  NotFoundPage: lazyView(loaders.NotFoundPage),
};

export async function initialViews(page?: PublicPage): Promise<PublicViews> {
  const view = page && publicViewName(page.path, page.status);
  // Hydrate against the rendered view before customer/cart effects update the
  // surrounding providers, so Suspense cannot replace the visible SSR body.
  return view
    ? { ...browserViews, [view]: await loaders[view]() }
    : browserViews;
}
