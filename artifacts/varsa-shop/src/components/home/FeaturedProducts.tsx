import { pagePath } from '@/lib/routes';
import { Link } from 'wouter';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { usePublicPage } from '@/lib/page-context';
import { SectionHeading } from '@/components/SectionHeading';
import { ProductCard } from '@/components/ProductCard';


export function FeaturedProducts() {
  const { data, loading } = usePublicPage();
  const products = data.products?.filter(product => product.is_featured);

  return (
    <section className="relative py-24">
      <div className="container-luxe">
        <SectionHeading
          title={<>منتخبی از <span className="gold-text">محصولات ورسا</span></>}
          subtitle="مشخصات، وزن و قیمت چند محصول از کاتالوگ فعلی ورسا را ببینید."
        />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent" strokeWidth={1.5} />
          </div>
        ) : data.products === null ? (
          <p className="py-20 text-center text-cream-400">بارگذاری محصولات با خطا روبه‌رو شد.</p>
        ) : !products?.length ? (
          <p className="py-20 text-center text-cream-400">هنوز محصولی برای نمایش در این بخش انتخاب نشده است.</p>
        ) : (
          <div className="mt-10 grid gap-5 sm:mt-14 sm:grid-cols-2 sm:gap-7 xl:grid-cols-4">
            {(products ?? []).map((p, i) => (
              <div key={p.id} className={`reveal reveal-delay-${(i % 4) + 1}`}>
                <ProductCard product={p} imageSizes="(min-width: 1280px) 276px, (min-width: 1024px) calc((100vw - 124px) / 2), (min-width: 640px) calc((100vw - 92px) / 2), calc(100vw - 32px)" />
              </div>
            ))}
          </div>
        )}

        <div className="mt-14 text-center">
          <Link href={pagePath('shop')} className="btn-gold">
            مشاهده‌ی همه‌ی محصولات
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </section>
  );
}
