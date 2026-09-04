import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, X } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { formatPrice, toFaDigits } from '@/lib/site';
import { getApiErrorMessage, submitOrder } from '@/lib/orders-api';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const { items, total, clear } = useCart();
  const [step, setStep] = useState<'form' | 'loading' | 'done'>('form');
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [orderNumber, setOrderNumber] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setError('');
      setOrderNumber('');
    }
  }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('loading');

    try {
      const result = await submitOrder({
        customerName: form.name,
        phone: form.phone,
        address: form.address,
        items: items.map(({ product, quantity }) => ({
          productId: product.id,
          name: product.name,
          quantity,
          unitPrice: product.price,
          imageUrl: product.image_url,
        })),
      });
      setOrderNumber(result.orderNumber);
      setStep('done');
      clear();
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'ثبت سفارش انجام نشد. لطفاً دوباره تلاش کنید.'));
      setStep('form');
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-md animate-fade-in" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg animate-scale-in overflow-hidden rounded-3xl border border-gold-500/25 bg-ink-900 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-gold-500/25 text-gold-200 transition-colors hover:bg-gold-500/15"
          aria-label="بستن"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>

        {step === 'done' ? (
          <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
            <CheckCircle2 className="h-16 w-16 text-gold-300" strokeWidth={1.2} />
            <h3 className="font-display text-2xl font-bold text-cream-50">سفارش ثبت شد</h3>
            <p className="max-w-sm text-sm leading-7 text-cream-300">
              از اعتماد شما سپاسگزاریم. سفارش شما با تیپاکس و بسته‌بندی ضربه‌گیر
              ارسال خواهد شد؛ ظرف ۲ تا ۵ روز کاری به دست شما می‌رسد.
            </p>
            <div className="rounded-xl border border-gold-500/20 bg-gold-500/10 px-4 py-3 text-sm text-gold-200">
              کد سفارش: <span className="font-bold tracking-wider">{orderNumber}</span>
            </div>
            <button onClick={onClose} className="btn-solid mt-4">
              بازگشت به فروشگاه
            </button>
          </div>
        ) : step === 'loading' ? (
          <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-gold-300" strokeWidth={1.3} />
            <p className="text-cream-200">در حال ثبت سفارش...</p>
          </div>
        ) : (
          <div className="max-h-[88vh] overflow-y-auto p-8">
            <h3 className="font-display text-xl font-bold text-cream-50">تکمیل خرید</h3>
            <p className="mt-2 text-sm text-cream-400">
              اطلاعات خود را وارد کنید تا سفارش با تیپاکس ارسال شود.
            </p>

            {/* Summary */}
            <div className="mt-5 space-y-3 rounded-2xl border border-gold-500/15 bg-white/[0.02] p-4">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex items-center justify-between text-sm">
                  <span className="text-cream-200">
                    {product.name} <span className="text-cream-400">×{toFaDigits(quantity)}</span>
                  </span>
                  <span className="text-gold-200">{formatPrice(product.price * quantity)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-gold-500/15 pt-3">
                <span className="text-cream-300">مجموع</span>
                <span className="text-lg font-bold text-gold-200">{formatPrice(total)}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error && (
                <div className="rounded-xl border border-crimson-500/30 bg-crimson-500/10 px-4 py-3 text-sm leading-6 text-crimson-300">
                  {error}
                </div>
              )}
              <div>
                <label className="label-luxe" htmlFor="ck-name">نام و نام خانوادگی</label>
                <input
                  id="ck-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="input-luxe"
                  placeholder="مثلاً: نگار احمدی"
                />
              </div>
              <div>
                <label className="label-luxe" htmlFor="ck-phone">شماره تماس</label>
                <input
                  id="ck-phone"
                  type="tel"
                  required
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="input-luxe text-right"
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                />
              </div>
              <div>
                <label className="label-luxe" htmlFor="ck-address">نشانی پستی</label>
                <textarea
                  id="ck-address"
                  required
                  rows={3}
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  className="input-luxe resize-none"
                  placeholder="نشانی کامل برای ارسال تیپاکس"
                />
              </div>
              <button type="submit" className="btn-solid w-full">
                ثبت نهایی سفارش
              </button>
              <p className="text-center text-xs text-cream-400">
                ارسال با تیپاکس — تحویل ۲ تا ۵ روز کاری
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
