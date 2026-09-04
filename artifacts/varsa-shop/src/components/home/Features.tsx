import { Leaf, Hand, ShieldCheck, Truck } from 'lucide-react';
import { ArabesqueDivider } from '@/components/Brand';

const FEATURES = [
  {
    icon: Leaf,
    title: 'کشت ارگانیک و بدون سم',
    text: 'زعفران ورسا بدون هیچ‌گونه کود شیمیایی یا سم کشت می‌شود؛ با گواهی آنالیز آزمایشگاهی.',
  },
  {
    icon: Hand,
    title: 'بدون دخالت دست',
    text: 'از چیدن گل تا بسته‌بندی، هیچ‌کدام از مراحل با دست انجام نمی‌شود؛ ضدعفونی مکانیکی و استاندارد.',
  },
  {
    icon: ShieldCheck,
    title: 'بسته‌بندی فلزی اختصاصی',
    text: 'بسته‌بندی فلزی با درب دوگانه، عطر و رطوبت را تا لحظه‌ی مصرف کامل نگه می‌دارد.',
  },
  {
    icon: Truck,
    title: 'ارسال امن و سریع',
    text: 'همکاری با تیپاکس، بسته‌بندی ضربه‌گیر و ضدآسیب؛ تحویل ۲ تا ۵ روز کاری.',
  },
];

export function Features() {
  return (
    <section className="relative border-y border-gold-500/10 bg-ink-800/60 py-20">
      <div className="absolute inset-0 bg-grid-gold opacity-20" />
      <div className="container-luxe relative z-10">
        <div className="mb-14 text-center">
          <span className="chip mb-4">چرا ورسا؟</span>
          <h2 className="font-display text-3xl font-bold text-cream-50 sm:text-4xl">
            اصالت، از <span className="gold-text">مزرعه تا سفره</span>
          </h2>
          <ArabesqueDivider className="mt-5" />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`reveal reveal-delay-${i + 1} card-luxe group p-7 text-center`}
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/5 transition-all duration-700 ease-luxe group-hover:border-gold-400 group-hover:shadow-gold">
                <f.icon className="h-7 w-7 text-gold-300" strokeWidth={1.3} />
              </div>
              <h3 className="mb-3 text-base font-semibold text-cream-50">{f.title}</h3>
              <p className="text-sm leading-7 text-cream-300">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
