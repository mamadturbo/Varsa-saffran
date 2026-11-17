import { pagePath } from '@/lib/routes';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { ArabesqueDivider, VarsaMark } from '@/components/Brand';


export function CtaBanner() {
  return (
    <section className="on-dark relative overflow-hidden bg-ink-950 py-32">
      <VarsaMark tone="gold" aria-hidden="true" className="pointer-events-none absolute -left-12 top-1/2 h-80 w-80 -translate-y-1/2 opacity-10" />

      <div className="container-luxe relative z-10 text-center">
        <ArabesqueDivider className="mb-8" />
        <h2 className="reveal mx-auto max-w-3xl font-display text-3xl font-bold leading-tight text-cream-50 text-balance sm:text-4xl lg:text-5xl">
          عطر خورشید را <span className="gold-text">چشیده‌اید؟</span>
        </h2>
        <p className="reveal reveal-delay-1 mx-auto mt-6 max-w-xl text-lg leading-8 text-cream-200 text-pretty">
          برای آشپزی روزانه، مهمانی یا هدیه، بسته‌های زعفران ورسا را ببینید و انتخاب کنید.
        </p>
        <div className="reveal reveal-delay-2 mt-10 flex flex-wrap justify-center gap-4">
          <Link href={pagePath('shop')} className="btn-solid">
            مشاهده محصولات
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          </Link>
          <Link href={pagePath('about')} className="btn-ghost">
            داستان ما را بخوانید
          </Link>
        </div>
      </div>
    </section>
  );
}
