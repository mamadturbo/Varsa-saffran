import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useSearch } from 'wouter/use-browser-location';
import { ArrowLeft, BookOpen, Gift, Loader2, Package } from 'lucide-react';
import { fetchProducts } from '@/lib/api';
import { useAsyncData } from '@/lib/hooks-extra';
import { useReveal } from '@/lib/hooks';
import { formatPrice, formatWeight, toFaDigits } from '@/lib/site';
import { pagePath } from '@/lib/routes';
import { shopCategoryHref } from '@/lib/shop-filter';
import { buildGuideGroups, categoryGuide, GUIDE_MODES, guideModeHref, isGiftCategory, readGuideMode } from '@/lib/buying-guide';
import { SectionHeading } from '@/components/SectionHeading';
import { SaffronCut } from '@/components/SaffronCut';

export function GuidePage() {
  const ref = useReveal<HTMLElement>();
  const [, navigate] = useLocation();
  const search = useSearch();
  const mode = readGuideMode(search);
  const [attempt, setAttempt] = useState(0);
  const { data: products, loading, error } = useAsyncData(fetchProducts, [attempt]);
  const groups = useMemo(() => buildGuideGroups(products ?? [], mode), [products, mode]);

  return (
    <main ref={ref} className="pb-20 pt-32">
      <div className="container-luxe">
        <SectionHeading as="h1" eyebrow="پیش از خرید" title="کدام زعفران را انتخاب کنم؟"
          subtitle="از شکل برش شروع کنید، بعد وزن و مبلغ هر بسته را کنار هم ببینید. برای هدیه، محتویات همان پک هم مهم است." />

        <section className="mt-12" aria-labelledby="guide-categories">
          <h2 id="guide-categories" className="text-xl font-bold text-cream-50">مقایسه دسته‌های فعلی</h2>
          <fieldset className="mt-5">
            <legend className="mb-3 text-sm text-cream-300">چه چیزی برایتان اولویت دارد؟</legend>
            <div className="flex flex-wrap gap-3">
              {GUIDE_MODES.map(item => (
                <label key={item.value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm ${mode === item.value ? 'border-gold-400 bg-gold-500/15 text-cream-50' : 'border-gold-500/25 text-cream-300'}`}>
                  <input type="radio" name="guide-mode" value={item.value} checked={mode === item.value}
                    onChange={() => navigate(guideModeHref(item.value, search))} className="h-4 w-4 accent-gold-700 dark:accent-gold-300" />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="mt-4 text-sm leading-7 text-cream-300">
            {mode === 'price'
              ? 'دسته‌ها بر اساس کمترین مبلغ یک بسته مرتب شده‌اند. وزن بسته‌ها یکسان نیست؛ مبلغ کمترِ بسته به‌تنهایی به معنی ارزش خرید بیشتر نیست.'
              : mode === 'gift'
                ? 'دسته‌هایی که در کاتالوگ عنوان هدیه دارند اینجا نمایش داده می‌شوند. محتویات و وزن هر پک را پیش از انتخاب بررسی کنید.'
                : 'توضیح برش‌ها عمومی است؛ تعداد، وزن‌ها و بازه قیمت از کاتالوگ فعلی ورسا می‌آیند. نام دسته به‌تنهایی جای مشخصات و گزارش آزمایش همان محموله را نمی‌گیرد.'}
          </p>

          {loading ? (
            <p role="status" className="mt-8 flex items-center gap-2 text-cream-300"><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />در حال دریافت محصولات برای راهنما...</p>
          ) : error ? (
            <div role="alert" className="card-luxe mt-8 p-6">
              <p className="text-cream-200">دریافت محصولات برای مقایسه انجام نشد.</p>
              <button className="btn-gold mt-4" onClick={() => setAttempt(value => value + 1)}>تلاش دوباره</button>
            </div>
          ) : groups.length === 0 ? (
            <div className="card-luxe mt-8 p-6">
              <p role="status" className="text-cream-200">{products?.length ? 'در دسته‌های فعلی گزینه‌ای با عنوان هدیه ثبت نشده است.' : 'کاتالوگ فعلی محصولی برای مقایسه ندارد.'}</p>
              {mode === 'gift' && !!products?.length && <Link href={guideModeHref('types', search)} className="btn-gold mt-4">شناخت همه دسته‌ها</Link>}
            </div>
          ) : (
            <>
              <p role="status" className="mt-6 text-sm text-cream-400">{toFaDigits(groups.length)} دسته برای مقایسه</p>
              <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {groups.map(group => {
                  const explanation = categoryGuide(group.category);
                  const Icon = isGiftCategory(group.category) ? Gift : Package;
                  return (
                    <article key={group.category} className="card-luxe flex flex-col p-6">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-bold text-cream-50">{group.category}</h3>
                        <span className="text-xs text-cream-400">{toFaDigits(group.count)} محصول در کاتالوگ</span>
                      </div>
                      <div className="mt-4">
                        {explanation.cut ? <SaffronCut kind={explanation.cut} /> : <Icon aria-hidden="true" className="h-8 w-8 text-accent" strokeWidth={1.4} />}
                      </div>
                      <p className="mt-4 text-sm leading-7 text-cream-300">{explanation.text}</p>
                      <dl className="mt-5 space-y-3 text-sm">
                        <div><dt className="text-cream-400">وزن‌های ثبت‌شده</dt><dd className="mt-1 text-cream-100">{group.weights.length ? group.weights.map(item => formatWeight(item.weight, item.unit)).join('، ') : 'وزن را در مشخصات محصول بررسی کنید.'}</dd></div>
                        <div><dt className="text-cream-400">بازه مبلغ هر بسته</dt><dd className="mt-1 font-semibold text-price">{group.minPrice === group.maxPrice ? formatPrice(group.minPrice) : `${formatPrice(group.minPrice)} تا ${formatPrice(group.maxPrice)}`}</dd></div>
                      </dl>
                      {mode === 'price' && <p className="mt-4 text-xs leading-6 text-cream-300">کمترین مبلغ بسته در این دسته: {group.lowestPriceProduct.name}، {formatPrice(group.lowestPriceProduct.price)}</p>}
                      <Link href={shopCategoryHref(group.category)} className="btn-gold mt-6 self-start">دیدن محصولات {group.category}<ArrowLeft aria-hidden="true" className="h-4 w-4" /></Link>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <section aria-labelledby="guide-before-buying" className="mt-12 rounded-2xl border border-gold-500/20 bg-ink-800/50 p-6 sm:p-8">
          <h2 id="guide-before-buying" className="flex items-center gap-2 text-xl font-bold text-cream-50"><BookOpen aria-hidden="true" className="h-5 w-5 text-accent" />سه نکته پیش از انتخاب</h2>
          <ol className="mt-5 list-decimal space-y-3 pr-5 text-sm leading-7 text-cream-200">
            <li>برای مصرف کم یا اولین خرید، مقدار مورد نیازتان را مشخص کنید و وزن خالص روی همان محصول را بخوانید؛ تعداد وعده ثابتی برای هر بسته فرض نکنید.</li>
            <li>برای هدیه، وزن زعفران را از تعداد جعبه‌ها و لوازم داخل پک جدا کنید. قیمت پک شامل همین محتویات است.</li>
            <li>برای بررسی کیفیت، مشخصات و گزارش آزمایش مربوط به همان محصول و محموله را بخواهید؛ تصویر بسته‌بندی و نام تجاری به‌تنهایی مدرک کیفیت نیستند.</li>
          </ol>
          <details className="mt-6 text-sm text-cream-300">
            <summary className="min-h-11 cursor-pointer py-3 text-accent">درباره توضیح تفاوت برش‌ها</summary>
            <p className="mt-2 leading-7">توضیح نگین، سرگل و پوشال بر اساس شکل کلاله و میزان بخش خامه است؛ شمای کنار کارت‌ها تصویر واقعی محصول نیست.</p>
            <a className="mt-3 inline-block underline underline-offset-4" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC7174224/" target="_blank" rel="noreferrer">پژوهش درباره تفاوت ظاهری نگین، سرگل و پوشال</a>
            <span aria-hidden="true"> · </span>
            <a className="mt-3 inline-block underline underline-offset-4" href="https://www.iso.org/standard/86798.html" target="_blank" rel="noreferrer">استاندارد مشخصات زعفران ISO 3632-1</a>
          </details>
          <Link href={pagePath('shop')} className="btn-solid mt-6">دیدن همه محصولات<ArrowLeft aria-hidden="true" className="h-4 w-4" /></Link>
        </section>
      </div>
    </main>
  );
}
