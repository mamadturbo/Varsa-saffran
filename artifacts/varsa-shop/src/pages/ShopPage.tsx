import { useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useSearch } from "wouter/use-browser-location";
import { readShopCategory, shopCategoryHref } from "@/lib/shop-filter";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { fetchProducts } from "@/lib/api";
import { useReveal } from "@/lib/hooks";
import { useAsyncData } from "@/lib/hooks-extra";
import { ProductCard } from "@/components/ProductCard";
import { SectionHeading } from "@/components/SectionHeading";
import { formatWeight, toFaDigits } from "@/lib/site";
import { pagePath } from "@/lib/routes";
import { catalogWeightChoices, matchesShopWeight, readShopWeight, shopWeightHref, validWeight, weightChoiceKey } from '@/lib/product-comparison';
import { ProductComparison } from '@/components/ProductComparison';
import { restorePendingDialogFocus } from '@/lib/dialog-focus';

export function ShopPage() {
  const ref = useReveal<HTMLElement>();
  const { data: products, loading, error } = useAsyncData(fetchProducts, []);
  const search = useSearch();
  const [, navigate] = useLocation();
  const active = readShopCategory(search);
  const selectedWeight = readShopWeight(search);
  useEffect(() => { if (!loading) restorePendingDialogFocus(); }, [loading, products]);
  const categories = useMemo(
    () => [
      null,
      ...new Set([
        ...(products ?? []).map((p) => p.category),
        ...(active ? [active] : []),
      ]),
    ],
    [products, active],
  );
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [search]);

  const categoryProducts = useMemo(
    () =>
      (products ?? []).filter((p) => active === null || p.category === active),
    [products, active],
  );
  const weightChoices = catalogWeightChoices(categoryProducts);
  const selectedKey = selectedWeight ? weightChoiceKey(selectedWeight) : '';
  const selectedExists = selectedWeight && weightChoices.some(choice => weightChoiceKey(choice) === selectedKey);
  const filtered = categoryProducts.filter(product => matchesShopWeight(product, selectedWeight));

  return (
    <main ref={ref} className="pt-32">
      {/* Header */}
      <section className="relative border-b border-gold-500/10 pb-12">
        <div className="absolute inset-0 bg-grid-gold opacity-20" />
        <div className="container-luxe relative z-10 text-center">
          <SectionHeading as="h1"
            eyebrow="فروشگاه ورسا"
            title={
              <>
                زعفران <span className="gold-text">دلخواهتان</span> را انتخاب کنید
              </>
            }
            subtitle="دسته‌بندی، وزن و قیمت بسته‌ها را مقایسه کنید و پیش از افزودن به سبد، جزئیات هر محصول را بخوانید."
          />
          <Link href={pagePath('guide')} className="btn-gold mt-6">برای انتخاب زعفران راهنمایی می‌خواهید؟</Link>
        </div>
      </section>

      {/* Filters + grid */}
      <section className="py-14">
        <div className="container-luxe">
          {/* Filters */}
          <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
            <span className="flex items-center gap-2 text-sm text-cream-400">
              <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} />
              دسته‌بندی:
            </span>
            {categories.map((cat) => (
              <Link
                key={cat === null ? "all" : `category:${cat}`}
                href={shopCategoryHref(cat, search)}
                aria-current={active === cat ? "page" : undefined}
                className={`inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition-all duration-500 ease-luxe ${
                  active === cat
                    ? "border-gold-400 bg-gold-500/15 text-cream-50 shadow-gold"
                    : "border-gold-500/20 text-cream-300 hover:border-gold-500/40 hover:text-cream-100"
                }`}
              >
                {cat ?? "همه"}
              </Link>
            ))}
          </div>

          {!loading && !error && <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
            <label htmlFor="shop-weight" className="text-sm text-cream-200">وزن بسته:</label>
            <select id="shop-weight" value={selectedKey} onChange={event => navigate(shopWeightHref(weightChoices.find(choice => weightChoiceKey(choice) === event.target.value) ?? null, search))}
              className="min-h-11 max-w-full rounded-xl border border-gold-500/30 bg-ink-900 px-4 py-2 text-sm text-cream-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-600">
              <option value="">همه وزن‌ها</option>
              {weightChoices.map(choice => <option key={weightChoiceKey(choice)} value={weightChoiceKey(choice)}>{formatWeight(choice.weight, choice.unit)}</option>)}
              {selectedWeight && !selectedExists && <option value={selectedKey}>{validWeight(selectedWeight) ? `${formatWeight(Number(selectedWeight.weight), selectedWeight.unit)} — در این دسته موجود نیست` : 'وزن انتخاب‌شده نامعتبر است'}</option>}
            </select>
            {selectedWeight && <Link href={shopWeightHref(null, search)} className="inline-flex min-h-11 items-center text-sm text-accent underline underline-offset-4">پاک کردن فیلتر وزن</Link>}
          </div>}

          {!loading && !error && (
            <p
              role="status"
              className="mb-6 text-center text-sm text-cream-400"
            >
              {toFaDigits(filtered.length)} محصول
            </p>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2
                className="h-8 w-8 animate-spin text-accent"
                strokeWidth={1.5}
              />
            </div>
          ) : error ? (
            <p className="py-20 text-center text-cream-400">
              بارگذاری محصولات با خطا روبه‌رو شد. لطفاً دوباره تلاش کنید.
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-20 text-center text-cream-400">
              محصولی مطابق دسته و وزن انتخاب‌شده یافت نشد.
            </p>
          ) : (
            <>
              <ProductComparison products={filtered} search={search} />
              <div className="grid gap-5 sm:grid-cols-2 sm:gap-7 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((p, i) => (
                  <div
                    key={p.id}
                    className={`reveal reveal-delay-${(i % 4) + 1}`}
                  >
                    <ProductCard product={p} headingLevel={2} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
