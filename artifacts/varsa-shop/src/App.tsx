import { useEffect, useState, lazy, Suspense } from "react";
import { Router, Route, Switch, useLocation } from "wouter";
import { CartProvider } from "@/lib/cart";
import { ThemeProvider } from "@/lib/theme";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { CheckoutModal } from "@/components/CheckoutModal";
import { HomePage } from "@/pages/HomePage";
import { ShopPage } from "@/pages/ShopPage";
import { GuidePage } from "@/pages/GuidePage";
import { JournalPage } from "@/pages/JournalPage";
import { ArticlePage } from "@/pages/ArticlePage";
import { AboutPage } from "@/pages/AboutPage";
import { ContactPage } from "@/pages/ContactPage";
import { ProductRoute } from "@/pages/ProductRoute";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { lastPathSegment } from "@/lib/routes";
import { DocumentMeta } from "@/components/DocumentMeta";
import { StoreContentProvider } from "@/lib/store-content";
import { CustomerProvider } from "@/lib/customer";
import { PaymentPage } from "@/pages/PaymentPage";
const AdminPage = lazy(() =>
  import("@/pages/AdminPage").then((m) => ({ default: m.AdminPage })),
);
const CustomerAccount = lazy(() =>
  import("@/pages/CustomerAccount").then((m) => ({
    default: m.CustomerAccount,
  })),
);

function Storefront() {
  const [location, navigate] = useLocation();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const page = location.startsWith("/journal/")
    ? "journal"
    : location.startsWith("/products/")
      ? "shop"
      : location === "/"
        ? "home"
        : location.replace(/^\//, "").replace(/\/$/, "");
  useEffect(() => {
    setCheckoutOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return (
    <StoreContentProvider>
      <div className="relative min-h-screen bg-ink-900">
        <Header page={page} />
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/shop" component={ShopPage} />
          <Route path="/guide" component={GuidePage} />
          <Route path="/journal" component={JournalPage} />
          <Route path="/journal/:slug">
            {() => {
              const slug = lastPathSegment(window.location.pathname);
              return slug ? (
                <ArticlePage key={location} slug={slug} />
              ) : (
                <NotFoundPage />
              );
            }}
          </Route>
          <Route path="/products/:slug">
            {() => <ProductRoute key={location} />}
          </Route>
          <Route path="/about" component={AboutPage} />
          <Route path="/contact" component={ContactPage} />
          <Route path="/account" component={CustomerAccount} />
          <Route path="/payment/:id">{params => <PaymentPage key={params.id} id={params.id}/>}</Route>
          <Route component={NotFoundPage} />
        </Switch>
        <Footer />
        <CartDrawer
          onCheckout={() => setCheckoutOpen(true)}
          onContinue={() => navigate("/shop")}
        />
        <CheckoutModal
          isOpen={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
        />
      </div>
    </StoreContentProvider>
  );
}
export default function App() {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
  return (
    <Router base={base}>
      <ThemeProvider>
        <CustomerProvider>
          <CartProvider>
            <DocumentMeta />
            <Suspense
              fallback={
                <main
                  role="status"
                  className="min-h-screen bg-ink-900 px-6 py-32 text-center text-cream-200"
                >
                  در حال دریافت صفحه…
                </main>
              }
            >
              <Switch>
                <Route path="/admin" component={AdminPage} />
                <Route component={Storefront} />
              </Switch>
            </Suspense>
          </CartProvider>
        </CustomerProvider>
      </ThemeProvider>
    </Router>
  );
}
