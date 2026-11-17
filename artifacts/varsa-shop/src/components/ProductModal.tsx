import { useRef } from 'react';
import { FlaskConical, ShoppingBag, X } from 'lucide-react';
import { Link } from 'wouter';
import { useSearch } from 'wouter/use-browser-location';
import type { Product } from '@/lib/types';
import { useCart } from '@/lib/cart';
import { SITE, formatPrice, formatWeight, toFaDigits } from '@/lib/site';
import { useShippingInfo } from '@/lib/store-content';
import { isBrandArtworkUrl } from '@/lib/brand-artwork';
import { productPath } from '@/lib/routes';
import { categoryPackages } from '@/lib/product-comparison';
import { UnitPrice } from './UnitPrice';
import { StoreDialog, StoreDialogTitle } from './StoreDialog';
import { DeliveryImage } from './DeliveryImage';
import { FavoriteButton, ProductReviews } from './CustomerTools';

interface ProductModalProps {
  product: Product | null;
  products: Product[];
  onClose: () => void;
}

export function ProductModal({ product, products, onClose }: ProductModalProps) {
  const shipping = useShippingInfo();
  const { add } = useCart();
  const search = useSearch();
  const titleRef = useRef<HTMLHeadingElement>(null);

  if (!product) return null;
  const illustrated = isBrandArtworkUrl(product.image_url, `${window.location.origin}${import.meta.env.BASE_URL}`);

  return (
    <StoreDialog id="product-dialog" open onClose={onClose} layer={80} initialFocus={titleRef}
      className="store-modal fixed inset-x-4 top-1/2 mx-auto w-auto max-w-4xl -translate-y-1/2 overflow-hidden rounded-3xl border border-gold-500/25 bg-ink-900 shadow-2xl outline-none sm:inset-x-6">
        <button
          onClick={onClose}
          className="on-dark absolute left-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-gold-500/25 bg-ink-950/90 text-accent backdrop-blur-sm transition-colors hover:bg-ink-950"
          aria-label="بستن"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>

        <div className="store-modal-scroll grid overflow-y-auto lg:grid-cols-2">
          {/* Image */}
          <div className="relative aspect-[4/3] sm:aspect-[16/10] lg:sticky lg:top-0 lg:aspect-square lg:self-start">
            <DeliveryImage
              src={product.image_url}
              alt={illustrated ? `تصویرسازی ${product.name}` : product.name}
              sizes="(min-width: 1024px) 448px, (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
              loading="eager"
              className={`h-full w-full ${illustrated ? 'object-contain' : 'object-cover'}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-900/40 to-transparent lg:bg-gradient-to-l" />
            <span className="absolute right-4 top-4 chip backdrop-blur-sm">{product.category}</span>
            {illustrated && <p className="absolute inset-x-0 bottom-0 bg-ink-900 px-4 py-2 text-center text-xs text-cream-400">تصویرسازی بسته‌بندی ورسا</p>}
          </div>

          {/* Details */}
          <div className="flex min-w-0 flex-col p-4 sm:p-8">
            <StoreDialogTitle asChild><h1 ref={titleRef} tabIndex={-1} className="font-display text-2xl font-bold leading-9 text-cream-50">
              {product.name}
            </h1></StoreDialogTitle>
            <p className="mt-3 text-sm leading-7 text-cream-300 text-pretty">
              {product.long_description ?? product.short_description}
            </p>

            {/* Lab analysis */}
            <div className="mt-6 rounded-2xl border border-gold-500/20 bg-gold-500/[0.04] p-3 sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <h2 className="text-sm font-semibold text-accent">شاخص‌های درج‌شده در کاتالوگ</h2>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'کروسین', value: product.crocin },
                  { label: 'پیکروکروسین', value: product.picrocrocin },
                  { label: 'سافرانال', value: product.safranal },
                ].map((m) => (
                  <div key={m.label}>
                    <p className="text-xl font-bold text-accent">{toFaDigits(m.value)}</p>
                    <p className="mt-0.5 text-[11px] text-cream-400">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Weight & price */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-cream-400">وزن خالص</p>
                <p className="text-base font-semibold text-cream-100">
                  {formatWeight(product.weight, product.weight_unit)}
                </p>
              </div>
              <div className="text-left">
                <p className="text-xs text-cream-400">قیمت</p>
                <p className="text-2xl font-bold text-price">{formatPrice(product.price)}</p>
              </div>
            </div>

            <div className="mt-3"><UnitPrice product={product} /></div>

            {categoryPackages(products, product).length > 1 && <section className="mt-6" aria-labelledby="category-packages">
              <h2 id="category-packages" className="text-sm font-semibold text-cream-100">بسته‌های این دسته</h2>
              <p className="mt-2 text-xs leading-6 text-cream-300">هر گزینه محصول مستقلی است؛ نام، وزن و محتویات بسته را پیش از انتخاب بررسی کنید.</p>
              <div className="mt-3 grid gap-2">
                {categoryPackages(products, product).map(option => <Link key={option.id} href={productPath(option.slug) + search}
                  aria-current={option.id === product.id ? 'page' : undefined}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-sm leading-6 ${option.id === product.id ? 'border-gold-600 bg-gold-500/10 text-cream-50' : 'border-gold-500/25 text-cream-200 hover:border-gold-600'}`}>
                  <span className="block">{option.name}{option.id === product.id ? ' — انتخاب فعلی' : ''}</span>
                  <span className="block text-xs text-cream-300">{formatWeight(option.weight, option.weight_unit)} · {formatPrice(option.price)}</span>
                </Link>)}
              </div>
            </section>}

              <div className="mt-auto pt-8">
                <div className="mb-4 flex justify-end"><FavoriteButton productId={product.id}/></div>
              <div className="flex gap-3">
                <button
                  disabled={product.stock === 0 || product.active === false}
                  onClick={() => {
                    add(product);
                    onClose();
                  }}
                  className="btn-solid flex-1"
                >
                  <ShoppingBag className="h-4 w-4" strokeWidth={1.8} />
                  {product.stock === 0 ? 'ناموجود' : 'افزودن به سبد خرید'}
                </button>
              </div>
              <p className="mt-4 text-center text-xs text-cream-400">
                {shipping}
              </p>
                <ProductReviews productId={product.id}/>
            </div>
          </div>
        </div>
    </StoreDialog>
  );
}
