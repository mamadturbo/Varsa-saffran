import { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { Product } from '@/lib/types';
import { fetchFeaturedProducts } from '@/lib/api';
import { SectionHeading } from '@/components/SectionHeading';
import { ProductCard } from '@/components/ProductCard';
import { useAsyncData } from '@/lib/hooks-extra';

interface FeaturedProps {
  onNavigate: (page: string) => void;
  onOpenProduct: (product: Product) => void;
}

export function FeaturedProducts({ onNavigate, onOpenProduct }: FeaturedProps) {
  const { data: products, loading, error } = useAsyncData(fetchFeaturedProducts, []);

  return (
    <section className="relative py-24">
      <div className="container-luxe">
        <SectionHeading
          eyebrow="منتخبِ ورسا"
          title={<>محصولات <span className="gold-text">ناب</span> ما</>}
          subtitle="از نگین بی‌نقص تا پک‌های هدیه‌ی مجلل؛ هر بسته، عطر کویر را در خود دارد."
        />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gold-400" strokeWidth={1.5} />
          </div>
        ) : error ? (
          <p className="py-20 text-center text-cream-400">بارگذاری محصولات با خطا روبه‌رو شد.</p>
        ) : (
          <div className="mt-14 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {(products ?? []).map((p, i) => (
              <div key={p.id} className={`reveal reveal-delay-${(i % 4) + 1}`}>
                <ProductCard product={p} onOpen={onOpenProduct} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-14 text-center">
          <button onClick={() => onNavigate('shop')} className="btn-gold">
            مشاهده‌ی همه‌ی محصولات
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </section>
  );
}
