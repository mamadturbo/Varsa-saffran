import { pagePath, articlePath } from '@/lib/routes';
import { Link } from 'wouter';
import { ArrowLeft, Clock, Loader2 } from 'lucide-react';
import { usePublicPage } from '@/lib/page-context';
import { GUIDE_ARTICLES } from '@/lib/guide-articles';
import { toFaDigits } from '@/lib/site';
import { SectionHeading } from '@/components/SectionHeading';
import { DeliveryImage } from '@/components/DeliveryImage';


export function JournalPreview() {
  const { data, loading } = usePublicPage();
  const articles = data.articles;
  const error = articles === null;

  const featured = articles?.[0];
  const rest = articles?.slice(1, 4) ?? [];

  return (
    <section className="relative border-t border-gold-500/10 bg-ink-800/40 py-24">
      <div className="container-luxe">
        <SectionHeading
          title={<>دست‌نوشته‌های <span className="gold-text">عطر کویر</span></>}
          subtitle="نوشته‌هایی درباره انتخاب، نگهداری و استفاده از زعفران در آشپزی."
        />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent" strokeWidth={1.5} />
          </div>
        ) : error ? (
          <p className="py-20 text-center text-cream-400">بارگذاری مقالات با خطا روبه‌رو شد.</p>
        ) : !featured ? (
          <p className="py-20 text-center text-cream-400">هنوز مقاله‌ای در مجله منتشر نشده است.</p>
        ) : (
          <div className="mt-14 grid gap-7 lg:grid-cols-2">
            {/* Featured article */}
            <article
              className="reveal card-luxe group flex flex-col overflow-hidden lg:flex-row"
            >
              <Link href={articlePath(featured.slug)}
                className="relative h-56 overflow-hidden lg:h-auto lg:w-1/2"
              >
                <DeliveryImage
                  src={featured.image_url}
                  alt={featured.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-[1200ms] ease-luxe group-hover:scale-110"
                />
                <span className="absolute right-3 top-3 chip backdrop-blur-sm">
                  {featured.category}
                </span>
              </Link>
              <div className="flex flex-1 flex-col p-6 lg:w-1/2">
                <h3 className="text-xl font-bold leading-8 text-cream-50">{featured.title}</h3>
                <p className="mt-3 line-clamp-3 flex-1 text-sm leading-7 text-cream-300">
                  {featured.excerpt}
                </p>
                <div className="mt-5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-cream-400">
                    <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {toFaDigits(featured.read_time)} دقیقه مطالعه
                  </span>
                  <Link href={articlePath(featured.slug)}
                    className="flex items-center gap-1 text-sm font-medium text-accent transition-colors hover:text-accent"
                  >
                    ادامه مطلب
                    <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                  </Link>
                </div>
              </div>
            </article>

            {/* Rest */}
            <div className="flex flex-col gap-5">
              {rest.map((a, i) => (
                <article
                  key={a.id}
                  className={`reveal reveal-delay-${i + 1} card-luxe group flex gap-4 overflow-hidden p-4`}
                >
                  <Link href={articlePath(a.slug)}
                    className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl"
                  >
                    <DeliveryImage
                      src={a.image_url}
                      alt={a.title}
                      loading="lazy"
                      crop="square"
                      sizes="96px"
                      className="h-full w-full object-cover transition-transform duration-700 ease-luxe group-hover:scale-110"
                    />
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <span className="text-[11px] text-accent">{a.category}</span>
                    <h3 className="mt-1 text-sm font-semibold leading-6 text-cream-50">
                      {a.title}
                    </h3>
                    <div className="mt-auto flex items-center gap-1.5 pt-2 text-xs text-cream-400">
                      <Clock className="h-3 w-3" strokeWidth={1.5} />
                      {toFaDigits(a.read_time)} دقیقه
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {GUIDE_ARTICLES.map(article => <li key={article.slug}>
            <Link href={article.path} className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{article.title}</Link>
          </li>)}
        </ul>
        <div className="mt-12 text-center">
          <Link href={pagePath('journal')} className="btn-gold">
            ورود به مجله دلگشا
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </section>
  );
}
