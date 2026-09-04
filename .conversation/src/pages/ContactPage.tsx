import { useState } from 'react';
import { CheckCircle2, Clock, Loader2, MapPin, Phone, Send, Truck } from 'lucide-react';
import { SITE } from '@/lib/site';
import { toFaDigits } from '@/lib/site';
import { submitContact } from '@/lib/api';
import { useReveal } from '@/lib/hooks';
import { SectionHeading } from '@/components/SectionHeading';
import { ArabesqueDivider } from '@/components/Brand';

const SHIPPING_INFO = [
  { icon: Truck, title: 'ارسال امن و سریع', text: SITE.shipping },
  { icon: Clock, title: 'زمان تحویل', text: '۲ تا ۵ روز کاری پس از ثبت سفارش' },
  { icon: MapPin, title: 'پوشش ارسال', text: 'سراسر ایران از طریق تیپاکس' },
];

export function ContactPage() {
  const ref = useReveal<HTMLElement>();
  const [form, setForm] = useState({ name: '', phone: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const update = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.message) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      await submitContact(form);
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
          <SectionHeading
            eyebrow="تماس و ارسال"
            title={<>با گرمی <span className="gold-text">به صدای شما</span> می‌رسیم</>}
            subtitle="پرسشی دارید یا سفارشی؟ تیم پشتیبانی ورسا با پاسخگویی گرم و رسمی، در کنار شماست."
          />
        </div>
      </section>

      <section className="py-14">
        <div className="container-luxe">
          <div className="grid gap-12 lg:grid-cols-2">
            {/* Form */}
            <div className="reveal card-luxe p-8">
              <h3 className="font-display text-xl font-bold text-cream-50">فرم تماس سریع</h3>
              <ArabesqueDivider className="my-5 justify-start" />

              {status === 'success' ? (
                <div className="flex flex-col items-center gap-4 py-10 text-center">
                  <CheckCircle2 className="h-14 w-14 text-gold-300" strokeWidth={1.2} />
                  <p className="text-lg font-semibold text-cream-50">پیام شما دریافت شد</p>
                  <p className="max-w-sm text-sm text-cream-300">
                    از تماس شما سپاسگزاریم. تیم ورسا در اولین فرصت با شما تماس خواهد گرفت.
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
                    <label className="label-luxe" htmlFor="phone">شماره تماس</label>
                    <input
                      id="phone"
                      type="tel"
                      required
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                      dir="ltr"
                      className="input-luxe text-right"
                    />
                  </div>
                  <div>
                    <label className="label-luxe" htmlFor="subject">موضوع</label>
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
                <h3 className="mb-4 text-lg font-semibold text-gold-200">پشتیبانی ورسا</h3>
                <ul className="space-y-4 text-sm">
                  <li className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-5 w-5 text-gold-400" strokeWidth={1.5} />
                    <div>
                      <p className="text-cream-400">شماره پشتیبانی</p>
                      <p className="text-cream-100" dir="ltr">{toFaDigits(SITE.phone)}</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 text-gold-400" strokeWidth={1.5} />
                    <div>
                      <p className="text-cream-400">نشانی</p>
                      <p className="text-cream-100">{SITE.address}</p>
                    </div>
                  </li>
                </ul>
              </div>

              {SHIPPING_INFO.map((info, i) => (
                <div key={info.title} className={`reveal reveal-delay-${i + 2} card-luxe flex gap-4 p-6`}>
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/5">
                    <info.icon className="h-5 w-5 text-gold-300" strokeWidth={1.4} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-cream-50">{info.title}</h4>
                    <p className="mt-1 text-sm leading-7 text-cream-300">{info.text}</p>
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
