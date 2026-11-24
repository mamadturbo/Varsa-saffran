import { useEffect, lazy, Suspense, type ComponentType } from "react";
import { Link, Router, useLocation } from "wouter";
import { CartProvider } from "@/lib/cart";
import { ThemeProvider } from "@/lib/theme";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { basePrefix } from "@/lib/page-meta";
import type { Article, Product } from "@/lib/types";
import { storefrontRoute } from "@/lib/routes";
import { DocumentMeta } from "@/components/DocumentMeta";
import {
  PublicPageProvider,
  usePublicPage,
  type StorefrontBootstrap,
} from "@/lib/page-context";
import { StoreContentProvider } from "@/lib/store-content";
import { CustomerProvider } from "@/lib/customer";

export interface PublicViews {
  HomePage: ComponentType;
  ShopPage: ComponentType<{ category?: string }>;
  GuidePage: ComponentType;
  JournalPage: ComponentType;
  ArticlePage: ComponentType<{ article: Article }>;
  AboutPage: ComponentType;
  ContactPage: ComponentType;
  ProductRoute: ComponentType<{ product: Product }>;
  NotFoundPage: ComponentType;
}

// Private screens render on the client.
const CheckoutPage = import.meta.env.SSR
  ? () => null
  : lazy(() =>
      import("@/pages/CheckoutPage").then((m) => ({
        default: m.CheckoutPage,
      })),
    );
const PaymentPage = import.meta.env.SSR
  ? () => null
  : lazy(() =>
      import("@/pages/PaymentPage").then((m) => ({ default: m.PaymentPage })),
    );
const AdminPage = import.meta.env.SSR
  ? () => null
  : lazy(() =>
      import("@/pages/AdminPage").then((m) => ({ default: m.AdminPage })),
    );
const CustomerAccount = import.meta.env.SSR
  ? () => null
  : lazy(() =>
      import("@/pages/CustomerAccount").then((m) => ({
        default: m.CustomerAccount,
      })),
    );

function LoadingPage() {
  return (
    <main
      role="status"
      className="min-h-[65vh] px-6 py-36 text-center text-cream-200"
    >
      در حال دریافت صفحه…
    </main>
  );
}

function Page({ views }: { views: PublicViews }) {
  const {
    HomePage,
    ShopPage,
    GuidePage,
    JournalPage,
    ArticlePage,
    AboutPage,
    ContactPage,
    ProductRoute,
    NotFoundPage,
  } = views;
  const { data, config, loading, reload } = usePublicPage();
  const route = storefrontRoute(data.path);
  if (route.kind === "checkout") return <CheckoutPage stage={route.stage} />;
  if (loading) return <LoadingPage />;
  if (data.status === 404) return <NotFoundPage />;
  if (data.status === 503)
    return (
      <main className="container-luxe min-h-[65vh] pt-36 text-center">
        <h1 className="text-2xl font-bold text-cream-50">
          صفحه موقتاً در دسترس نیست
        </h1>
        <p className="mt-4 text-cream-300">
          برای دریافت اطلاعات تازه کمی بعد دوباره تلاش کنید.
        </p>
        <a
          className="btn-gold mt-6"
          href={basePrefix(config.basePath) + data.path}
          onClick={(event) => {
            event.preventDefault();
            reload();
          }}
        >
          تلاش دوباره
        </a>
        <Link className="btn-gold mx-2 mt-6" href="/">
          صفحه اصلی
        </Link>
      </main>
    );
  switch (route.kind) {
    case "home":
      return <HomePage />;
    case "shop":
      return <ShopPage />;
    case "category":
      return <ShopPage category={route.category} />;
    case "guide":
      return <GuidePage />;
    case "journal":
      return <JournalPage />;
    case "article":
    case "editorial":
      return data.article ? (
        <ArticlePage key={data.path} article={data.article} />
      ) : (
        <NotFoundPage />
      );
    case "product":
      return data.product ? (
        <ProductRoute key={data.path} product={data.product} />
      ) : (
        <NotFoundPage />
      );
    case "about":
      return <AboutPage />;
    case "contact":
      return <ContactPage />;
    case "account":
      return <CustomerAccount />;
    case "payment":
      return <PaymentPage key={route.slug} id={route.slug} />;
    default:
      return <NotFoundPage />;
  }
}

function Storefront({ views }: { views: PublicViews }) {
  const { data } = usePublicPage();
  const [location] = useLocation();
  const route = storefrontRoute(data.path);
  const page =
    route.kind === "product" || route.kind === "category"
      ? "shop"
      : route.kind === "article"
        ? "journal"
        : route.kind === "editorial"
          ? "guide"
          : route.kind;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);

  return (
    <StoreContentProvider>
      <div className="relative min-h-screen bg-ink-900">
        <Header page={page} />
        <Suspense fallback={<LoadingPage />}>
          <Page views={views} />
        </Suspense>
        {route.kind !== "account" && <Footer />}
      </div>
    </StoreContentProvider>
  );
}

function AppRoutes({ views }: { views: PublicViews }) {
  const { data, loading } = usePublicPage();
  if (storefrontRoute(data.path).kind === "admin") {
    return (
      <Suspense fallback={<LoadingPage />}>
        {loading ? <LoadingPage /> : <AdminPage />}
      </Suspense>
    );
  }
  return <Storefront views={views} />;
}

export default function App({
  initial,
  target,
  views,
}: {
  initial?: StorefrontBootstrap;
  target?: string;
  views: PublicViews;
}) {
  return (
    <Router
      base={import.meta.env.BASE_URL.replace(/\/+$/, "")}
      ssrPath={target}
    >
      <PublicPageProvider initial={initial}>
        <ThemeProvider>
          <CustomerProvider>
            <CartProvider>
              <DocumentMeta />
              <AppRoutes views={views} />
            </CartProvider>
          </CustomerProvider>
        </ThemeProvider>
      </PublicPageProvider>
    </Router>
  );
}
