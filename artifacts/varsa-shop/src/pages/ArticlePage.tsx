import { useEffect } from 'react';
import { ArrowRight, Clock, Loader2 } from 'lucide-react';
import { fetchArticleBySlug } from '@/lib/api';
import { toFaDigits } from '@/lib/site';
import { useAsyncData } from '@/lib/hooks-extra';
import { ArabesqueDivider } from '@/components/Brand';

interface ArticlePageProps {
  slug: string;
  onBack: () => void;
}

export function ArticlePage({ slug, onBack }: ArticlePageProps) {
  const { data: article, loading, error } = useAsyncData(
    () => fetchArticleBySlug(slug),
    [slug]
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [slug]);

  if (loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center pt-32">
        <Loader2 className="h-8 w-8 animate-spin text-gold-400" strokeWidth={1.5} />
      </main>
    );
  }

  if (error || !article) {
    return (
      <main className="pt-32">
        <div className="container-luxe py-20 text-center">
          <p className="text-cream-300">مقاله یافت نشد.</p>
          <button onClick={onBack} className="btn-gold mt-6">
            بازگشت به مجله
          </button>
        </div>
      </main>
    );
  }

  const paragraphs = article.content.split('\n').filter(Boolean);

  return (
    <main className="pt-32">
      <article>
        {/* Hero */}
        <div className="relative h-[52vh] min-h-[380px] overflow-hidden">
          <img
            src={article.image_url}
            alt={article.title}
            className="h-full w-full object-cover animate-slow-zoom"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/50 to-ink-950/30" />
          <div className="absolute inset-x-0 bottom-0">
            <div className="container-luxe pb-10">
              <span className="chip backdrop-blur-sm">{article.category}</span>
              <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold leading-tight text-cream-50 text-balance sm:text-4xl lg:text-5xl">
                {article.title}
              </h1>
              <div className="mt-4 flex items-center gap-4 text-sm text-cream-300">
                <span>{article.author}</span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {toFaDigits(article.read_time)} دقیقه مطالعه
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="container-luxe py-16">
          <div className="mx-auto max-w-3xl">
            <button
              onClick={onBack}
              className="mb-8 flex items-center gap-2 text-sm text-gold-200 transition-colors hover:text-gold-100"
            >
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
              بازگشت به مجله دلگشا
            </button>

            <ArabesqueDivider className="mb-10" />

            <div className="space-y-6">
              {paragraphs.map((para, i) => {
                if (para.startsWith('## ')) {
                  return (
                    <h2
                      key={i}
                      className="pt-4 font-display text-2xl font-bold text-gold-200"
                    >
                      {para.replace(/^##\s+/, '')}
                    </h2>
                  );
                }
                return (
                  <p key={i} className="text-base leading-9 text-cream-200 text-pretty">
                    {para}
                  </p>
                );
              })}
            </div>

            <ArabesqueDivider className="my-12" />

            <div className="rounded-2xl border border-gold-500/20 bg-gradient-to-b from-gold-500/[0.06] to-transparent p-6 text-center">
              <p className="font-display text-lg text-gold-200">عطر کویر را چشیده‌اید؟</p>
              <p className="mt-2 text-sm text-cream-300">
                زعفران ورسا را از فروشگاه ما سفارش دهید و تفاوت را احساس کنید.
              </p>
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
