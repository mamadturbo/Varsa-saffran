import { useEffect, useRef, useState } from 'react';
import { ClipboardCheck, Loader2, X } from 'lucide-react';
import type { CreateOrderResponse } from '@workspace/api-client-react';
import { useCart } from '@/lib/cart';
import { formatPrice, toFaDigits } from '@/lib/site';
import { submitOrder } from '@/lib/orders-api';
import { getOrderSubmitErrorMessage, ORDER_RECEIPT_STATUS } from '@/lib/order-receipt';
import { fetchProducts } from '@/lib/api';
import { reconcileCart } from '@workspace/catalog';
import { normalizeIranMobile, MOBILE_PHONE_ERROR, PHONE_INPUT_MAX_LENGTH } from '@workspace/validation';
import { StoreDialog, StoreDialogTitle } from './StoreDialog';
import { quoteOrder } from '@/lib/management-api';
import type { OrderPricing } from '@workspace/catalog';
import { useCustomer } from '@/lib/customer';
import { Link } from 'wouter';
import { CardTransferPayment } from './CardTransferPayment';
import { rememberPayment } from '@/lib/payment-api';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const { customer } = useCustomer();
  const addressText = (a: import('@workspace/catalog').CustomerAddress) => `${a.province}، ${a.city}، ${a.address}، کد پستی ${a.postalCode}، گیرنده: ${a.recipient} (${a.phone})`;
  const { items, attemptId, total, clear, replaceItems } = useCart();
  const submitting = useRef(false);
  const [step, setStep] = useState<'form' | 'loading' | 'done'>('form');
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [receipt, setReceipt] = useState<CreateOrderResponse | null>(null);
  const [orderKey, setOrderKey] = useState<string>();
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [quote, setQuote] = useState<OrderPricing | null>(null);
  const [quoting, setQuoting] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!isOpen || !customer) return;
    const a = customer.profile.addresses.find(a => a.isDefault) ?? customer.profile.addresses[0];
    setForm(previous => ({ name: a?.recipient || customer.profile.name || previous.name, phone: customer.phone, address: a ? addressText(a) : previous.address }));
  }, [isOpen, customer?.id]);

  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setError('');
      setPhoneError('');
      setReceipt(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) titleRef.current?.focus();
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen || !items.length || step === 'done') return;
    let active = true;
    setQuoting(true); setQuote(null);
    quoteOrder(items.map(i => ({ productId: i.product.id, quantity: i.quantity })), couponCode)
      .then(result => { if (active) setQuote(result); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message.replace(/^HTTP \d+ [^:]*:\s*/, '') : 'دریافت مبلغ سفارش انجام نشد.'); })
      .finally(() => { if (active) setQuoting(false); });
    return () => { active = false; };
  }, [isOpen, items, couponCode, step === 'done']);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current || step === 'done') return;
    const phone = normalizeIranMobile(form.phone);
    if (!phone) {
      setPhoneError(MOBILE_PHONE_ERROR);
      return;
    }
    setPhoneError('');
    setForm((previous) => ({ ...previous, phone }));
    submitting.current = true;
    setStep('loading');

    try {
      const products = await fetchProducts();
      const refreshed = reconcileCart(items, products);
      if (refreshed.missingIds.length > 0) {
        throw new Error('بعضی محصولات سبد دیگر موجود نیستند. لطفاً آن‌ها را از سبد حذف کنید.');
      }
      if (refreshed.changed) {
        replaceItems(refreshed.items);
        setError('اطلاعات محصولات سبد به‌روز شد. لطفاً قیمت‌ها را بررسی و دوباره سفارش را تأیید کنید.');
        setStep('form');
        return;
      }
      const freshQuote = await quoteOrder(items.map(i => ({ productId: i.product.id, quantity: i.quantity })), couponCode);
      if (!quote || JSON.stringify(freshQuote) !== JSON.stringify(quote)) {
        setQuote(freshQuote); setError('مبلغ سفارش به‌روز شد. هزینه ارسال و تخفیف را بررسی و دوباره تأیید کنید.'); setStep('form'); return;
      }
      const result = await submitOrder({
        idempotencyKey: attemptId,
        customerName: form.name,
        phone,
        address: form.address,
        expectedTotal: freshQuote.total,
        couponCode,
        items: items.map(({ product, quantity }) => ({
          productId: product.id,
          quantity,
        })),
      });
      setReceipt(result);
      setOrderKey(attemptId);
      rememberPayment(result.id, attemptId);
      setStep('done');
      clear();
    } catch (submitError) {
      setError(getOrderSubmitErrorMessage(submitError));
      setStep('form');
    } finally {
      submitting.current = false;
    }
  };

  const close = () => { if (!submitting.current) onClose(); };

  return (
    <StoreDialog id="checkout-dialog" open={isOpen} onClose={close} layer={85} initialFocus={titleRef} dismissible={step !== 'loading'} busy={step === 'loading'}
      className="store-modal fixed inset-x-4 top-1/2 mx-auto w-auto max-w-lg -translate-y-1/2 overflow-hidden rounded-3xl border border-gold-500/25 bg-ink-900 shadow-2xl outline-none">
        <button
          onClick={close}
          disabled={step === 'loading'}
          className="absolute left-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-gold-500/25 text-accent transition-colors hover:bg-gold-500/15"
          aria-label="بستن"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>

        {step === 'done' && receipt ? (
          <div role="status" className="store-modal-scroll flex flex-col items-center gap-4 overflow-y-auto px-8 py-12 text-center">
            <ClipboardCheck className="h-14 w-14 flex-shrink-0 text-accent" strokeWidth={1.2} />
            <StoreDialogTitle asChild><h2 ref={titleRef} tabIndex={-1} className="font-display text-2xl font-bold text-cream-50">{ORDER_RECEIPT_STATUS[receipt.status].title}</h2></StoreDialogTitle>
            <p className="max-w-sm text-sm leading-7 text-cream-300">
              {ORDER_RECEIPT_STATUS[receipt.status].message}
            </p>
            <dl className="w-full space-y-3 rounded-xl border border-gold-500/25 bg-gold-500/5 p-4 text-sm text-cream-200">
              <div><dt className="text-cream-400">کد سفارش</dt><dd dir="ltr" className="mt-1 select-all font-bold tracking-wider text-accent">{receipt.orderNumber}</dd></div>
              <div><dt className="text-cream-400">وضعیت سفارش در زمان دریافت رسید</dt><dd className={receipt.status === 'cancelled' ? 'mt-1 font-bold text-crimson-700 dark:text-crimson-300' : 'mt-1 font-bold'}>{ORDER_RECEIPT_STATUS[receipt.status].label}</dd></div>
              <div><dt className="text-cream-400">مبلغ سفارش ثبت‌شده</dt><dd className="mt-1 font-bold">{formatPrice(receipt.total)}</dd></div>
            </dl>
            <CardTransferPayment orderId={receipt.id} orderKey={orderKey}/>
            <Link href={`/payment/${receipt.id}`} onClick={onClose} className="btn-gold">صفحهٔ پرداخت و پیگیری رسید</Link>
            <p className="text-xs leading-6 text-cream-400">کد سفارش را برای مراجعه بعدی نگه دارید. {quote?.shippingConfigured ? 'هزینه ارسال در مبلغ سفارش لحاظ شده است.' : 'هزینه ارسال هنوز تعیین نشده؛ پیش از واریز با فروشگاه هماهنگ کنید.'}</p>
            <button onClick={onClose} className="btn-solid mt-4">
              ادامه خرید
            </button>
            <Link href="/account?view=orders" onClick={onClose} className="btn-gold">پیگیری سفارش در حساب من</Link>
          </div>
        ) : step === 'loading' ? (
          <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-accent" strokeWidth={1.3} />
            <StoreDialogTitle asChild><h2 ref={titleRef} tabIndex={-1} className="text-lg font-semibold text-cream-50">ثبت درخواست سفارش</h2></StoreDialogTitle>
            <p role="status" className="text-cream-200">در حال ثبت درخواست سفارش...</p>
          </div>
        ) : (
          <div className="store-modal-scroll overflow-y-auto p-4 sm:p-8">
            <StoreDialogTitle asChild><h2 ref={titleRef} tabIndex={-1} className="pl-14 font-display text-xl font-bold text-cream-50">ثبت درخواست سفارش</h2></StoreDialogTitle>
            <p className="mt-4 text-sm leading-7 text-cream-400">
              اطلاعات خود را برای ثبت سفارش وارد کنید. پس از ثبت، اطلاعات پرداخت و امکان ارسال رسید در صورت فعال بودن نمایش داده می‌شود.
            </p>

            {/* Summary */}
            <div className="mt-5 space-y-3 rounded-2xl border border-gold-500/15 bg-white/[0.02] p-4">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                  <span className="text-cream-200">
                    {product.name} <span className="text-cream-400">×{toFaDigits(quantity)}</span>
                  </span>
                  <span className="text-price">{formatPrice(product.price * quantity)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-gold-500/15 pt-3">
                <span className="text-cream-300">جمع کالاها</span>
                <span className="text-lg font-bold text-price">{formatPrice(total)}</span>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm text-cream-200">
              <label htmlFor="ck-coupon" className="label-luxe">کد تخفیف</label>
              <div className="flex flex-wrap gap-2"><input id="ck-coupon" className="input-luxe min-w-0 basis-28 flex-1" dir="ltr" maxLength={50} value={couponInput} onChange={e => setCouponInput(e.target.value)}/><button type="button" className="btn-gold !px-4" disabled={quoting} onClick={() => { setError(''); setCouponCode(couponInput.trim().toUpperCase()); }}>اعمال</button>{couponCode && <button type="button" className="btn-ghost !px-3" onClick={()=>{setCouponCode('');setCouponInput('');setError('');}}>حذف</button>}</div>
              {quoting ? <p role="status">در حال محاسبه مبلغ سفارش…</p> : quote && <><div className="flex flex-wrap justify-between gap-x-4 gap-y-1"><span>تخفیف {quote.couponCode}</span><span>{formatPrice(quote.discount)}</span></div><div className="flex flex-wrap justify-between gap-x-4 gap-y-1"><span>هزینه ارسال</span><span>{quote.shippingConfigured ? formatPrice(quote.shipping) : 'هنوز تعیین نشده'}</span></div><div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-gold-500/20 pt-3 font-bold"><span>مبلغ سفارش</span><span>{formatPrice(quote.total)}</span></div></>}
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {customer && customer.profile.addresses.length > 0 && <div><label className="label-luxe" htmlFor="ck-saved-address">انتخاب از آدرس‌های من</label><select id="ck-saved-address" className="input-luxe" defaultValue="" onChange={e=>{const a=customer.profile.addresses.find(a=>a.id===e.target.value);if(a)setForm(p=>({...p,name:a.recipient,address:addressText(a)}));}}><option value="">انتخاب آدرس ذخیره‌شده</option>{customer.profile.addresses.map(a=><option key={a.id} value={a.id}>{a.label} — {a.city}</option>)}</select></div>}
              {error && (
                <div role="alert" className="rounded-xl border border-crimson-500/30 bg-crimson-500/10 px-4 py-3 text-sm leading-6 text-crimson-700 dark:text-crimson-300">
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
                <label className="label-luxe" htmlFor="ck-phone">شماره موبایل</label>
                <input
                  id="ck-phone"
                  readOnly={Boolean(customer)}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={PHONE_INPUT_MAX_LENGTH}
                  required
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, phone: e.target.value }));
                    setPhoneError('');
                  }}
                  onBlur={() => setPhoneError(form.phone && !normalizeIranMobile(form.phone) ? MOBILE_PHONE_ERROR : '')}
                  onInvalid={() => setPhoneError(MOBILE_PHONE_ERROR)}
                  aria-invalid={Boolean(phoneError)}
                  aria-describedby={phoneError ? 'ck-phone-help ck-phone-error' : 'ck-phone-help'}
                  className="input-luxe text-right"
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                />
                <p id="ck-phone-help" className="mt-2 text-xs text-cream-400">موبایل ایران؛ ارقام فارسی، انگلیسی و پیش‌شمارهٔ +۹۸ پذیرفته می‌شوند.</p>
                {phoneError && <p id="ck-phone-error" role="alert" className="mt-2 text-sm text-crimson-500">{phoneError}</p>}
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
                  placeholder="نشانی کامل پستی"
                />
              </div>
              <button type="submit" disabled={!quote || quoting} className="btn-solid w-full disabled:opacity-50">
                ثبت درخواست سفارش
              </button>
              <p className="text-center text-xs text-cream-400">
                پس از ثبت درخواست، کد سفارش و وضعیت فعلی آن نمایش داده می‌شود.
              </p>
            </form>
          </div>
        )}
    </StoreDialog>
  );
}
