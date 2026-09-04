import { useEffect } from 'react';
import { FlaskConical, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import type { Product } from '@/lib/types';
import { useCart } from '@/lib/cart';
import { formatPrice, formatWeight, toFaDigits } from '@/lib/site';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

export function ProductModal({ product, onClose }: ProductModalProps) {
  const { add } = useCart();

  useEffect(() => {
    document.body.style.overflow = product ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [product]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!product) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-ink-950/80 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-4xl animate-scale-in overflow-hidden rounded-3xl border border-gold-500/25 bg-ink-900 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-gold-500/25 bg-ink-950/60 text-gold-200 backdrop-blur-sm transition-colors hover:bg-gold-500/15"
          aria-label="بستن"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>

        <div className="grid max-h-[88vh] overflow-y-auto md:grid-cols-2">
          {/* Image */}
          <div className="relative aspect-square md:aspect-auto">
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-900/40 to-transparent md:bg-gradient-to-l" />
            <span className="absolute right-4 top-4 chip backdrop-blur-sm">{product.category}</span>
          </div>

          {/* Details */}
          <div className="flex flex-col p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold leading-9 text-cream-50">
              {product.name}
            </h2>
            <p className="mt-3 text-sm leading-7 text-cream-300 text-pretty">
              {product.long_description ?? product.short_description}
            </p>

            {/* Lab analysis */}
            <div className="mt-6 rounded-2xl border border-gold-500/20 bg-gold-500/[0.04] p-5">
              <div className="mb-3 flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-gold-300" strokeWidth={1.5} />
                <h4 className="text-sm font-semibold text-gold-200">آنالیز آزمایشگاهی</h4>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'کروسین', value: product.crocin },
                  { label: 'پیکروکروسین', value: product.picrocrocin },
                  { label: 'سافرانال', value: product.safranal },
                ].map((m) => (
                  <div key={m.label}>
                    <p className="text-xl font-bold text-gold-200">{toFaDigits(m.value)}</p>
                    <p className="mt-0.5 text-[11px] text-cream-400">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Weight & price */}
            <div className="mt-6 flex items-center justify-between">
              <div>
                <p className="text-xs text-cream-400">وزن خالص</p>
                <p className="text-base font-semibold text-cream-100">
                  {formatWeight(product.weight, product.weight_unit)}
                </p>
              </div>
              <div className="text-left">
                <p className="text-xs text-cream-400">قیمت</p>
                <p className="text-2xl font-bold text-gold-200">{formatPrice(product.price)}</p>
              </div>
            </div>

            <div className="mt-auto pt-8">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    add(product);
                    onClose();
                  }}
                  className="btn-solid flex-1"
                >
                  <ShoppingBag className="h-4 w-4" strokeWidth={1.8} />
                  افزودن به سبد خرید
                </button>
              </div>
              <p className="mt-4 text-center text-xs text-cream-400">
                ارسال امن و سریع از طریق تیپاکس — تحویل ۲ تا ۵ روز کاری
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
