import { useEffect } from 'react';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { formatPrice, toFaDigits } from '@/lib/site';

interface CartDrawerProps {
  onCheckout: () => void;
  onContinue: () => void;
}

export function CartDrawer({ onCheckout, onContinue }: CartDrawerProps) {
  const { items, isOpen, close, remove, setQty, total, count, clear } = useCart();

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[70] bg-ink-950/70 backdrop-blur-sm transition-opacity duration-500 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={close}
      />

      {/* Drawer (slides from left for RTL) */}
      <aside
        className={`fixed inset-y-0 left-0 z-[71] flex w-full max-w-md flex-col border-r border-gold-500/20 bg-ink-900 shadow-2xl transition-transform duration-500 ease-luxe ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gold-500/15 px-6 py-5">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-5 w-5 text-gold-300" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-cream-50">سبد خرید</h3>
            {count > 0 && (
              <span className="rounded-full bg-gold-500/15 px-2.5 py-0.5 text-xs text-gold-200">
                {toFaDigits(count)} مورد
              </span>
            )}
          </div>
          <button
            onClick={close}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-500/20 text-gold-200 transition-colors hover:bg-gold-500/10"
            aria-label="بستن"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Items */}
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-gold-500/20 bg-gold-500/5">
              <ShoppingBag className="h-8 w-8 text-gold-500/50" strokeWidth={1.2} />
            </div>
            <p className="text-cream-200">سبد خرید شما خالی است</p>
            <p className="max-w-xs text-sm text-cream-400">
              عطر کویر را به سفره‌ی خود هدیه دهید؛ از فروشگاه ورسا انتخاب کنید.
            </p>
            <button
              onClick={() => {
                close();
                onContinue();
              }}
              className="btn-gold mt-2"
            >
              مشاهده فروشگاه
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {items.map(({ product, quantity }) => (
                <div
                  key={product.id}
                  className="flex gap-4 rounded-xl border border-gold-500/15 bg-white/[0.02] p-3"
                >
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium leading-6 text-cream-100">
                        {product.name}
                      </h4>
                      <button
                        onClick={() => remove(product.id)}
                        className="text-cream-500 transition-colors hover:text-crimson-400"
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>
                    <span className="mt-0.5 text-xs text-gold-400">{product.category}</span>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center gap-1 rounded-full border border-gold-500/25">
                        <button
                          onClick={() => setQty(product.id, quantity - 1)}
                          className="flex h-7 w-7 items-center justify-center text-gold-200 transition-colors hover:text-gold-100"
                          aria-label="کمتر"
                        >
                          <Minus className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                        <span className="w-6 text-center text-sm text-cream-100">
                          {toFaDigits(quantity)}
                        </span>
                        <button
                          onClick={() => setQty(product.id, quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center text-gold-200 transition-colors hover:text-gold-100"
                          aria-label="بیشتر"
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-gold-200">
                        {formatPrice(product.price * quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={clear}
                className="mx-auto flex items-center gap-2 text-xs text-cream-500 transition-colors hover:text-crimson-400"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                خالی کردن سبد
              </button>
            </div>

            {/* Footer */}
            <div className="border-t border-gold-500/15 px-6 py-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-cream-300">مجموع</span>
                <span className="text-lg font-bold text-gold-200">{formatPrice(total)}</span>
              </div>
              <p className="mb-4 rounded-lg bg-gold-500/5 px-3 py-2 text-center text-xs text-cream-400">
                ارسال امن و سریع از طریق تیپاکس — تحویل ۲ تا ۵ روز کاری
              </p>
              <button onClick={onCheckout} className="btn-solid w-full">
                تکمیل خرید
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
