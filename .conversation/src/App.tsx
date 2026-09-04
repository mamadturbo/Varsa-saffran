import { useEffect, useState } from 'react';
import type { Product } from '@/lib/types';
import { CartProvider } from '@/lib/cart';
import { ThemeProvider } from '@/lib/theme';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CartDrawer } from '@/components/CartDrawer';
import { ProductModal } from '@/components/ProductModal';
import { CheckoutModal } from '@/components/CheckoutModal';
import { HomePage } from '@/pages/HomePage';
import { ShopPage } from '@/pages/ShopPage';
import { JournalPage } from '@/pages/JournalPage';
import { ArticlePage } from '@/pages/ArticlePage';
import { AboutPage } from '@/pages/AboutPage';
import { ContactPage } from '@/pages/ContactPage';

type Page = 'home' | 'shop' | 'journal' | 'article' | 'about' | 'contact';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [articleSlug, setArticleSlug] = useState<string>('');
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const navigate = (next: string) => {
    const target = (['home', 'shop', 'journal', 'about', 'contact'] as Page[]).includes(
      next as Page
    )
      ? (next as Page)
      : 'home';
    setPage(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openArticle = (slug: string) => {
    setArticleSlug(slug);
    setPage('article');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  return (
    <ThemeProvider>
      <CartProvider>
        <div className="relative min-h-screen bg-ink-900">
          <Header page={page} onNavigate={navigate} />

        <div className="pt-0">
          {page === 'home' && (
            <HomePage
              onNavigate={navigate}
              onOpenProduct={setOpenProduct}
              onOpenArticle={openArticle}
            />
          )}
          {page === 'shop' && <ShopPage onOpenProduct={setOpenProduct} />}
          {page === 'journal' && <JournalPage onOpenArticle={openArticle} />}
          {page === 'article' && (
            <ArticlePage slug={articleSlug} onBack={() => navigate('journal')} />
          )}
          {page === 'about' && <AboutPage onNavigate={navigate} />}
          {page === 'contact' && <ContactPage />}
        </div>

        <Footer onNavigate={navigate} />

        {/* Overlays */}
        <CartDrawer
          onCheckout={() => setCheckoutOpen(true)}
          onContinue={() => navigate('shop')}
        />
        <ProductModal product={openProduct} onClose={() => setOpenProduct(null)} />
          <CheckoutModal isOpen={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
        </div>
      </CartProvider>
    </ThemeProvider>
  );
}
