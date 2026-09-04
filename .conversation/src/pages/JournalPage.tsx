import { useState } from 'react';
import { ArrowLeft, Clock, Loader2 } from 'lucide-react';
import type { Article } from '@/lib/types';
import { fetchArticles } from '@/lib/api';
import { useReveal } from '@/lib/hooks';
import { useAsyncData } from '@/lib/hooks-extra';
import { toFaDigits } from '@/lib/site';
import { SectionHeading } from '@/components/SectionHeading';

interface JournalPageProps {
  onOpenArticle: (slug: string) => void;
}

export function JournalPage({ onOpenArticle }: JournalPageProps) {
  const ref = useReveal<HTMLElement>();
  const { data: articles, loading, error } = useAsyncData(fetchArticles, []);
  const cats = useMemoCats(articles);

  const [active, setActive] = useState('همه');
  const filtered = (articles ?? []).filter(
    (a) => active === 'همه' || a.category === active
  );

  return (
    <main ref={ref} className="pt-32">
      <section className="relative border-b border-gold-500/10 pb-12">
        <div className="absolute inset-0 bg-grid-gold opacity-20" />
        <div className="container-luxe relative z-10 text-center">
          <SectionHeading
            eyebrow="مجله دلگشا"
            title={<>نوشته‌هایی از <span className="gold-text">عطر و اصالت</span></>}
            subtitle="راهنماهای آموزشی، رازهای آشپزی و خواص زعفران؛ با لحنی گرم و کارشناسانه."
          />
        </div>
      </section>

      <section className="py-14">
        <div className="container-luxe">
          {/* Category filter */}
          <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
            {cats.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`rounded-full border px-5 py-2 text-sm font-medium transition-all duration-500 ease-luxe ${
                  active === cat
                    ? 'border-gold-400 bg-gold-500/15 text-gold-100 shadow-gold'
                    : 'border-gold-500/20 text-cream-300 hover:border-gold-500/40 hover:text-cream-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-gold-400" strokeWidth={1.5} />
            </div>
          ) : error || !articles?.length ? (
            <p className="py-20 text-center text-cream-400">مقاله‌ای یافت نشد.</p>
          ) : (
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((a, i) => (
                <article
                  key={a.id}
                  className={`reveal reveal-delay-${(i % 3) + 1} card-luxe group flex flex-col overflow-hidden`}
                >
                  <button
                    onClick={() => onOpenArticle(a.slug)}
                    className="relative aspect-[16/10] overflow-hidden"
                  >
                    <img
                      src={a.image_url}
                      alt={a.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-[1200ms] ease-luxe group-hover:scale-110"
                    />
                    <span className="absolute right-3 top-3 chip backdrop-blur-sm">
                      {a.category}
                    </span>
                  </button>
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-lg font-bold leading-8 text-cream-50">{a.title}</h3>
                    <p className="mt-3 line-clamp-3 flex-1 text-sm leading-7 text-cream-300">
                      {a.excerpt}
                    </p>
                    <div className="mt-5 flex items-center justify-between border-t border-gold-500/10 pt-4">
                      <span className="flex items-center gap-1.5 text-xs text-cream-400">
                        <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {toFaDigits(a.read_time)} دقیقه
                      </span>
                      <button
                        onClick={() => onOpenArticle(a.slug)}
                        className="flex items-center gap-1 text-sm font-medium text-gold-200 transition-colors hover:text-gold-100"
                      >
                        ادامه مطلب
                        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function useMemoCats(articles: Article[] | null): string[] {
  const cats = ['همه'];
  if (articles) {
    for (const a of articles) {
      if (!cats.includes(a.category)) cats.push(a.category);
    }
  }
  return cats;
}
