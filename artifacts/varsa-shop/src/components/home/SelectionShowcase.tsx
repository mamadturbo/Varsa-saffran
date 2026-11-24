import { SAFFRON_PHOTOS } from '@/lib/saffron-photos';
import { ArabesqueDivider } from '@/components/Brand';
import { SaffronPhoto } from '@/components/SaffronPhoto';

const DETAILS = [
  { label: 'دسته‌بندی', desc: 'نام دسته هر محصول' },
  { label: 'وزن خالص', desc: 'مقدار زعفران هر بسته' },
  { label: 'قیمت بسته', desc: 'مبلغ کالا به تومان' },
];

export function SelectionShowcase() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="container-luxe">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          {/* Text */}
          <div>
            <h2 className="font-display text-3xl font-bold text-cream-50 sm:text-4xl">
              مشخصات <span className="gold-text">همان بسته را بخوانید</span>
            </h2>
            <ArabesqueDivider className="mt-5 justify-start" />
            <p className="mt-5 max-w-lg text-base leading-8 text-cream-300 text-pretty">
              برای مقایسه، نام دسته، وزن خالص و قیمت هر بسته را کنار هم ببینید.
              توضیحات محصول و محتویات بسته‌های هدیه را هم بررسی کنید؛ تصویر
              بسته‌بندی به‌تنهایی همه جزئیات محصول را نشان نمی‌دهد.
            </p>

            <div className="selection-details mt-10 grid gap-5 sm:grid-cols-3">
              {DETAILS.map((m, i) => (
                <div
                  key={m.label}
                  className={`reveal reveal-delay-${i + 1} rounded-2xl border border-gold-500/20 bg-gradient-to-b from-ink-700/60 to-ink-800/80 p-5 text-center`}
                >
                  <h3 className="text-base font-bold text-accent">{m.label}</h3>
                  <p className="mt-0.5 text-xs text-cream-400">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Image */}
          <div className="reveal reveal-delay-2 relative">
            <SaffronPhoto photo={SAFFRON_PHOTOS.field} />
            <div className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-crimson-700/10 blur-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
