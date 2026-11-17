import { DeliveryImage } from '@/components/DeliveryImage';
import { Link } from 'wouter';
import { useEffect } from 'react';
import { ArrowRight, Clock, Loader2 } from 'lucide-react';
import { fetchArticleBySlug } from '@/lib/api';
import { toFaDigits } from '@/lib/site';
import { useAsyncData } from '@/lib/hooks-extra';
import { ArabesqueDivider } from '@/components/Brand';
import { articleBlocks } from '@/lib/article-blocks';

interface ArticlePageProps {
  slug: string;
}

export function ArticlePage({ slug }: ArticlePageProps) {
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
        <Loader2 className="h-8 w-8 animate-spin text-accent" strokeWidth={1.5} />
      </main>
    );
  }

  if (error || !article) {
    return (
      <main className="pt-32">
        <div className="container-luxe py-20 text-center">
          <h1 className="text-xl font-bold text-cream-300">{error ? 'دریافت مقاله انجام نشد' : 'مقاله یافت نشد'}</h1>
          <Link href="/journal" className="btn-gold mt-6">
            بازگشت به مجله
          </Link>
        </div>
      </main>
    );
  }

  const blocks = articleBlocks(article.content);

  return (
    <main className="pt-32">
      <article>
        {/* Hero */}
        <div className="on-dark relative flex min-h-[380px] items-end overflow-hidden sm:min-h-[440px]">
          <DeliveryImage
            src={article.image_url}
            alt={article.title}
            decoding="async"
            loading="eager"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover animate-slow-zoom"
          />
          <div className="absolute inset-0 img-overlay-article" />
          <div className="relative w-full pt-16">
            <div className="container-luxe pb-10">
              <span className="chip backdrop-blur-sm">{article.category}</span>
              <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold leading-tight text-cream-50 text-balance sm:text-4xl lg:text-5xl">
                {article.title}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-cream-300">
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
            <Link href="/journal"
              className="mb-8 flex min-h-11 items-center gap-2 text-sm text-accent transition-colors hover:text-accent"
            >
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
              بازگشت به مجله دلگشا
            </Link>

            <ArabesqueDivider className="mb-10" />

            <div className="space-y-6">
              {blocks.map((block, i) => {
                if (block.type === 'heading') {
                  const Heading = `h${block.level}` as const;
                  return (
                    <Heading
                      key={i}
                      className="pt-4 font-display text-2xl font-bold text-accent"
                    >
                      {block.text}
                    </Heading>
                  );
                }
                return (
                  <p key={i} className="text-base leading-9 text-cream-200 text-pretty">
                    {block.text}
                  </p>
                );
              })}
            </div>

            <ArabesqueDivider className="my-12" />

            <div className="rounded-2xl border border-gold-500/20 bg-gradient-to-b from-gold-500/[0.06] to-transparent p-6 text-center">
              <p className="font-display text-lg text-accent">عطر کویر را چشیده‌اید؟</p>
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
