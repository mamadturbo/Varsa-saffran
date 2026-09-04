import { useMemo, useState } from 'react';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import type { Product } from '@/lib/types';
import { fetchProducts } from '@/lib/api';
import { CATEGORIES } from '@/lib/site';
import { useReveal } from '@/lib/hooks';
import { useAsyncData } from '@/lib/hooks-extra';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeading } from '@/components/SectionHeading';
import { toFaDigits } from '@/lib/site';

interface ShopPageProps {
  onOpenProduct: (product: Product) => void;
}

export function ShopPage({ onOpenProduct }: ShopPageProps) {
  const ref = useReveal<HTMLElement>();
  const { data: products, loading, error } = useAsyncData(fetchProducts, []);
  const [active, setActive] = useState<string>('همه');

  const filtered = useMemo(
    () => (products ?? []).filter((p) => active === 'همه' || p.category === active),
    [products, active]
  );

  return (
    <main ref={ref} className="pt-32">
      {/* Header */}
      <section className="relative border-b border-gold-500/10 pb-12">
        <div className="absolute inset-0 bg-grid-gold opacity-20" />
        <div className="container-luxe relative z-10 text-center">
          <SectionHeading
            eyebrow="فروشگاه ورسا"
            title={<>زعفران <span className="gold-text">اصیل</span> را چشیدن کنید</>}
            subtitle="از نگین بی‌نقص تا پک‌های هدیه‌ی مجلل؛ هر بسته با گواهی آنالیز آزمایشگاهی."
          />
        </div>
      </section>

      {/* Filters + grid */}
      <section className="py-14">
        <div className="container-luxe">
          {/* Filters */}
          <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
            <span className="flex items-center gap-2 text-sm text-cream-400">
              <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} />
              دسته‌بندی:
            </span>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`rounded-full border px-5 py-2 text-sm font-medium transition-all duration-500 ease-luxe ${
                  active === cat
                    ? 'border-gold-400 bg-gold-500/15 text-gold-100 shadow-gold'
                    : 'border-gold-500/20 text-cream-300 hover:border-gold-500/40 hover:text-cream-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-gold-400" strokeWidth={1.5} />
            </div>
          ) : error ? (
            <p className="py-20 text-center text-cream-400">
              بارگذاری محصولات با خطا روبه‌رو شد. لطفاً دوباره تلاش کنید.
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-20 text-center text-cream-400">محصولی در این دسته یافت نشد.</p>
          ) : (
            <>
              <p className="mb-6 text-center text-sm text-cream-400">
                {toFaDigits(filtered.length)} محصول
              </p>
              <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((p, i) => (
                  <div key={p.id} className={`reveal reveal-delay-${(i % 4) + 1}`}>
                    <ProductCard product={p} onOpen={onOpenProduct} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
