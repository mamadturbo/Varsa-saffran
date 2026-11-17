import { Link } from 'wouter';
import { ArrowLeft, Compass } from 'lucide-react';
import { pagePath } from '@/lib/routes';

export function GuideTeaser() {
  return (
    <section aria-labelledby="home-guide-title" className="border-y border-gold-500/15 bg-ink-800/50 py-12">
      <div className="container-luxe flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="max-w-2xl">
          <span className="mb-3 flex items-center gap-2 text-sm text-accent"><Compass aria-hidden="true" className="h-5 w-5" />پیش از انتخاب</span>
          <h2 id="home-guide-title" className="text-2xl font-bold leading-10 text-cream-50">برای انتخاب زعفران راهنمایی می‌خواهید؟</h2>
          <p className="mt-3 text-sm leading-7 text-cream-300">نوع زعفران، وزن بسته، کیفیت و قیمت محصولات را مقایسه کنید و بستهٔ مناسب نیاز خود را انتخاب کنید.</p>
        </div>
        <Link href={pagePath('guide')} className="btn-gold flex-shrink-0">راهنمای انتخاب زعفران<ArrowLeft aria-hidden="true" className="h-4 w-4" /></Link>
      </div>
    </section>
  );
}
