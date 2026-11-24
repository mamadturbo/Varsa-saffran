import { DeliveryImage } from '@/components/DeliveryImage';
import { Link } from 'wouter';
import { ArrowRight, Clock } from 'lucide-react';
import type { Article } from '@/lib/types';
import { GUIDE_ARTICLES } from '@/lib/guide-articles';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { toFaDigits } from '@/lib/site';
import { ArabesqueDivider } from '@/components/Brand';
import { articleBlocks, type ArticleBlock } from '@/lib/article-blocks';
import { usePublicPage } from '@/lib/page-context';
import { representativeProducts } from '@/lib/representative-products';
import { pagePath, productPath } from '@/lib/routes';

export function ArticlePage({ article }: { article: Article }) {
  const editorial = GUIDE_ARTICLES.find(guide => guide.slug === article.slug && guide.id === article.id);
  const { data } = usePublicPage();
  const blocks: (ArticleBlock & { source?: { url: string; label: string } })[] = editorial
    ? editorial.sections.flatMap(({ heading, text, source }) => [
        ...(heading ? [{ type: 'heading' as const, level: 2 as const, text: heading }] : []),
        { type: 'paragraph' as const, text, source },
      ])
    : articleBlocks(article.content);
  const related = editorial
    ? representativeProducts(data.products ?? []).filter(product => editorial.relatedCategories.includes(product.category))
    : [];

  return (
    <main className="pt-32">
      <div className="container-luxe"><PageBreadcrumbs /></div>
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
              <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold text-cream-50 text-balance sm:text-4xl lg:text-5xl">
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
            <Link href={editorial ? "/guide" : "/journal"}
              className="mb-8 flex min-h-11 items-center gap-2 text-sm text-accent transition-colors hover:text-accent"
            >
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
              {editorial ? "بازگشت به راهنمای انتخاب زعفران" : "بازگشت به مجله دلگشا"}
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
                    {block.source && (
                      <> <a className="text-sm text-accent underline underline-offset-4" href={block.source.url}>{block.source.label}</a></>
                    )}
                  </p>
                );
              })}
            </div>

            {related.length > 0 && (
              <section className="mt-10" aria-labelledby="related-guide-products">
                <h2 id="related-guide-products" className="font-display text-xl font-bold text-cream-50">بسته‌های مرتبط زعفران ورسا</h2>
                <ul className="mt-2">
                  {related.map(product => <li key={product.id}>
                    <Link href={productPath(product.slug)} className="inline-flex min-h-11 items-center text-sm text-accent underline underline-offset-4">{product.name}</Link>
                  </li>)}
                </ul>
              </section>
            )}
            {editorial?.slug === "store-saffron" && (
              <Link href={pagePath("contact")} className="mt-4 inline-flex min-h-11 items-center text-sm text-accent underline underline-offset-4">پیگیری بستهٔ آسیب‌دیده</Link>
            )}
            <ArabesqueDivider className="my-12" />

            <div className="rounded-2xl border border-gold-500/20 bg-gradient-to-b from-gold-500/[0.06] to-transparent p-6 text-center">
              <Link className="btn-gold" href="/shop">مقایسه وزن و قیمت بسته‌های زعفران</Link>
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
