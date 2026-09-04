import { QUALITY_IMAGES } from '@/lib/site';
import { ArabesqueDivider } from '@/components/Brand';

const METRICS = [
  { label: 'کروسین', desc: 'شاخص رنگ', value: '۲۶۸+', max: '۳۰۰' },
  { label: 'پیکروکروسین', desc: 'شاخص طعم', value: '۹۲+', max: '۱۰۰' },
  { label: 'سافرانال', desc: 'شاخص عطر', value: '۴۶+', max: '۶۰' },
];

export function QualityShowcase() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="container-luxe">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          {/* Text */}
          <div>
            <span className="chip mb-4">گواهی کیفی ISO 3632</span>
            <h2 className="font-display text-3xl font-bold leading-tight text-cream-50 sm:text-4xl">
              زعفرانی با <span className="gold-text">عطر و رنگِ تضمینی</span>
            </h2>
            <ArabesqueDivider className="mt-5 justify-start" />
            <p className="mt-5 max-w-lg text-base leading-8 text-cream-300 text-pretty">
              هر بسته‌ی ورسا با آنالیز آزمایشگاهی سه شاخص اصلی زعفران همراه است؛
              کروسین برای رنگ، پیکروکروسین برای طعم و سافرانال برای عطر. این
              اعداد، گواهی اصالتِ زعفران ورسا هستند.
            </p>

            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {METRICS.map((m, i) => (
                <div
                  key={m.label}
                  className={`reveal reveal-delay-${i + 1} rounded-2xl border border-gold-500/20 bg-gradient-to-b from-ink-700/60 to-ink-800/80 p-5 text-center`}
                >
                  <p className="text-3xl font-bold text-gold-200">{m.value}</p>
                  <p className="mt-1 text-sm font-medium text-cream-100">{m.label}</p>
                  <p className="mt-0.5 text-xs text-cream-400">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Image */}
          <div className="reveal reveal-delay-2 relative">
            <img
              src={QUALITY_IMAGES.threads}
              alt="زعفران مرغوب ورسا"
              loading="lazy"
              className="aspect-[4/5] w-full rounded-3xl object-cover shadow-2xl"
            />
            <div className="absolute -bottom-6 -right-6 rounded-2xl border border-gold-500/30 bg-ink-900/90 px-6 py-4 backdrop-blur-md">
              <p className="font-display text-lg text-gold-200">درجه‌ی S+</p>
              <p className="text-xs text-cream-400">بالاترین رتبه‌ی کیفی</p>
            </div>
            <div className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-crimson-700/10 blur-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
