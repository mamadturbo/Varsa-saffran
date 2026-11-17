import { useState } from 'react';
import { CheckCircle2, Loader2, Send, Truck } from 'lucide-react';
import { SITE } from '@/lib/site';
import { useShippingInfo } from '@/lib/store-content';
import { ContactDetails } from '@/components/ContactDetails';
import { SocialLinks } from '@/components/SocialLinks';
import { submitContact } from '@/lib/api';
import { useReveal } from '@/lib/hooks';
import { SectionHeading } from '@/components/SectionHeading';
import { ArabesqueDivider } from '@/components/Brand';
import { normalizeIranMobile, MOBILE_PHONE_ERROR, PHONE_INPUT_MAX_LENGTH } from '@workspace/validation';

const SHIPPING_INFO = [
  { icon: Truck, title: 'اطلاعات ارسال', text: SITE.shipping },
];

export function ContactPage() {
  const shipping = useShippingInfo();
  const ref = useReveal<HTMLElement>();
  const [form, setForm] = useState({ name: '', phone: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const update = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.message) return;
    const phone = normalizeIranMobile(form.phone);
    if (!phone) {
      setPhoneError(MOBILE_PHONE_ERROR);
      return;
    }
    setPhoneError('');
    setStatus('loading');
    setErrorMsg('');
    try {
      await submitContact({ ...form, phone });
      setStatus('success');
      setForm({ name: '', phone: '', subject: '', message: '' });
    } catch {
      setStatus('error');
      setErrorMsg('ارسال پیام با خطا روبه‌رو شد. لطفاً دوباره تلاش کنید.');
    }
  };

  return (
    <main ref={ref} className="pt-32">
      <section className="relative border-b border-gold-500/10 pb-12">
        <div className="absolute inset-0 bg-grid-gold opacity-20" />
        <div className="container-luxe relative z-10 text-center">
          <SectionHeading as="h1"
            eyebrow="تماس و ارسال"
            title={<>با <span className="gold-text">ورسا</span> در تماس باشید</>}
            subtitle="پرسش خود درباره محصولات یا سفارش را از طریق فرم زیر با ورسا در میان بگذارید."
          />
        </div>
      </section>

      <section className="py-14">
        <div className="container-luxe">
          <div className="grid gap-12 lg:grid-cols-2">
            {/* Form */}
            <div className="reveal card-luxe p-8">
              <h2 className="font-display text-xl font-bold text-cream-50">فرم تماس</h2>
              <ArabesqueDivider className="my-5 justify-start" />

              {status === 'success' ? (
                <div className="flex flex-col items-center gap-4 py-10 text-center">
                  <CheckCircle2 className="h-14 w-14 text-accent" strokeWidth={1.2} />
                  <p className="text-lg font-semibold text-cream-50">پیام شما دریافت شد</p>
                  <p className="max-w-sm text-sm text-cream-300">
                    از تماس شما سپاسگزاریم. پیام شما برای بررسی ثبت شد.
                  </p>
                  <button
                    onClick={() => setStatus('idle')}
                    className="btn-gold mt-2"
                  >
                    ارسال پیام دیگر
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="label-luxe" htmlFor="name">نام و نام خانوادگی</label>
                    <input
                      id="name"
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => update('name', e.target.value)}
                      placeholder="مثلاً: نگار احمدی"
                      className="input-luxe"
                    />
                  </div>
                  <div>
                    <label className="label-luxe" htmlFor="phone">شماره موبایل</label>
                    <input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={PHONE_INPUT_MAX_LENGTH}
                      required
                      value={form.phone}
                      onChange={(e) => {
                        update('phone', e.target.value);
                        setPhoneError('');
                      }}
                      onBlur={() => setPhoneError(form.phone && !normalizeIranMobile(form.phone) ? MOBILE_PHONE_ERROR : '')}
                      onInvalid={() => setPhoneError(MOBILE_PHONE_ERROR)}
                      aria-invalid={Boolean(phoneError)}
                      aria-describedby={phoneError ? 'contact-phone-help contact-phone-error' : 'contact-phone-help'}
                      placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                      dir="ltr"
                      className="input-luxe text-right"
                    />
                    <p id="contact-phone-help" className="mt-2 text-xs text-cream-400">موبایل ایران؛ ارقام فارسی، انگلیسی و پیش‌شمارهٔ +۹۸ پذیرفته می‌شوند.</p>
                    {phoneError && <p id="contact-phone-error" role="alert" className="mt-2 text-sm text-crimson-500">{phoneError}</p>}
                  </div>
                  <div>
                    <label className="label-luxe" htmlFor="subject">موضوع (اختیاری)</label>
                    <input
                      id="subject"
                      type="text"
                      value={form.subject}
                      onChange={(e) => update('subject', e.target.value)}
                      placeholder="موضوع پیام شما"
                      className="input-luxe"
                    />
                  </div>
                  <div>
                    <label className="label-luxe" htmlFor="message">پیام شما</label>
                    <textarea
                      id="message"
                      required
                      rows={5}
                      value={form.message}
                      onChange={(e) => update('message', e.target.value)}
                      placeholder="پیام خود را اینجا بنویسید..."
                      className="input-luxe resize-none"
                    />
                  </div>

                  {status === 'error' && (
                    <p className="rounded-lg border border-crimson-600/40 bg-crimson-600/10 px-4 py-3 text-sm text-crimson-300">
                      {errorMsg}
                    </p>
                  )}

                  <button type="submit" disabled={status === 'loading'} className="btn-solid w-full disabled:opacity-60">
                    {status === 'loading' ? (
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                    ) : (
                      <Send className="h-4 w-4" strokeWidth={1.8} />
                    )}
                    ارسال پیام
                  </button>
                </form>
              )}
            </div>

            {/* Info */}
            <div className="space-y-6">
              <div className="reveal reveal-delay-1 card-luxe p-7">
                <h2 className="mb-4 text-lg font-semibold text-accent">پشتیبانی ورسا</h2>
                <ContactDetails />
                <SocialLinks />
              </div>

              {SHIPPING_INFO.map((info, i) => (
                <div key={info.title} className={`reveal reveal-delay-${i + 2} card-luxe flex gap-4 p-6`}>
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/5">
                    <info.icon className="h-5 w-5 text-accent" strokeWidth={1.4} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-cream-50">{info.title}</h3>
                    <p className="mt-1 text-sm leading-7 text-cream-300">{shipping}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
