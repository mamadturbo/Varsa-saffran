import { useEffect, useMemo } from "react";
import * as Select from "@radix-ui/react-select";
import { Link, useLocation } from "wouter";
import { usePublicPage, useRawSearch } from "@/lib/page-context";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { categoryGuide } from "@/lib/buying-guide";
import { readShopCategory, shopListingHref } from "@/lib/shop-filter";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useReveal } from "@/lib/hooks";
import { ProductCard } from "@/components/ProductCard";
import { SectionHeading } from "@/components/SectionHeading";
import { formatWeight, toFaDigits } from "@/lib/site";
import { pagePath } from "@/lib/routes";
import {
  catalogWeightChoices,
  matchesShopWeight,
  readShopWeight,
  shopWeightHref,
  validWeight,
  weightChoiceKey,
} from "@/lib/product-comparison";
import { ProductComparison } from "@/components/ProductComparison";
import { restorePendingDialogFocus } from "@/lib/dialog-focus";

const ALL_WEIGHTS = "all";

export function ShopPage({ category }: { category?: string }) {
  const ref = useReveal<HTMLElement>();
  const { data, loading } = usePublicPage();
  const products = data.products;
  const search = useRawSearch();
  const [, navigate] = useLocation();
  const active = category ?? readShopCategory(search);
  const selectedWeight = readShopWeight(search);
  const weightHref = (choice: Parameters<typeof shopWeightHref>[0]) =>
    shopListingHref(
      active,
      shopWeightHref(choice, search).slice("/shop".length),
    );
  useEffect(() => {
    if (!loading) restorePendingDialogFocus();
  }, [loading, products]);
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
  const categoryProducts = useMemo(
    () =>
      (products ?? []).filter((p) => active === null || p.category === active),
    [products, active],
  );
  const weightChoices = catalogWeightChoices(categoryProducts);
  const selectedKey = selectedWeight
    ? weightChoiceKey(selectedWeight)
    : ALL_WEIGHTS;
  const weightOptions: { value: string; label: string; disabled?: boolean }[] =
    [
      { value: ALL_WEIGHTS, label: "همه وزن‌ها" },
      ...weightChoices.map((choice) => ({
        value: weightChoiceKey(choice),
        label: formatWeight(choice.weight, choice.unit),
      })),
    ];
  if (
    selectedWeight &&
    !weightOptions.some(({ value }) => value === selectedKey)
  ) {
    weightOptions.push({
      value: selectedKey,
      label: validWeight(selectedWeight)
        ? `${formatWeight(Number(selectedWeight.weight), selectedWeight.unit)} — در این دسته موجود نیست`
        : "وزن انتخاب‌شده نامعتبر است",
      disabled: true,
    });
  }
  const filtered = categoryProducts.filter((product) =>
    matchesShopWeight(product, selectedWeight),
  );

  return (
    <main ref={ref} className="pt-32">
      {/* Header */}
      <section className="relative border-b border-gold-500/10 pb-12">
        <div className="absolute inset-0 bg-grid-gold opacity-20" />
        <div className="container-luxe relative z-10 text-center">
          {category && <PageBreadcrumbs />}
          <SectionHeading
            as="h1"
            eyebrow="فروشگاه ورسا"
            title={
              category ? (
                category === "هدیه" ? (
                  "بسته‌های هدیه زعفران"
                ) : (
                  `زعفران ${category}`
                )
              ) : (
                <>
                  زعفران <span className="gold-text">دلخواهتان</span> را انتخاب
                  کنید
                </>
              )
            }
            subtitle={
              category
                ? categoryGuide(category).text
                : "دسته‌بندی، وزن و قیمت بسته‌ها را مقایسه کنید و پیش از افزودن به سبد، جزئیات هر محصول را بخوانید."
            }
          />
          <Link href={pagePath("guide")} className="btn-gold mt-6">
            برای انتخاب زعفران راهنمایی می‌خواهید؟
          </Link>
        </div>
      </section>

      {/* Filters + grid */}
      <section className="pb-14 pt-7 sm:pt-10">
        <div className="container-luxe">
          <div className="mb-4 grid gap-4 rounded-2xl border border-gold-500/25 bg-gold-500/5 p-4 md:grid-cols-[minmax(0,1fr)_15rem] md:gap-5 sm:px-5">
            <div className="min-w-0">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <span
                  id="shop-categories"
                  className="flex items-center gap-2 text-sm font-semibold text-cream-100"
                >
                  <SlidersHorizontal
                    aria-hidden="true"
                    className="size-4 shrink-0 text-accent"
                    strokeWidth={1.5}
                  />
                  دسته‌بندی
                </span>
                {!loading && (
                  <p role="status" className="text-sm text-cream-400">
                    {toFaDigits(filtered.length)} محصول
                  </p>
                )}
              </div>
              <nav
                aria-labelledby="shop-categories"
                className="flex flex-wrap gap-2"
              >
                {categories.map((cat) => (
                  <Link
                    key={cat === null ? "all" : `category:${cat}`}
                    href={shopListingHref(cat, search)}
                    aria-current={active === cat ? "page" : undefined}
                    className="inline-flex min-h-11 min-w-14 max-w-full items-center justify-center rounded-full border border-gold-500/30 bg-ink-900 px-3.5 py-2 text-center text-sm font-medium text-cream-200 transition-colors hover:border-gold-500/70 hover:bg-gold-500/10 aria-[current=page]:border-gold-600 aria-[current=page]:bg-gold-500/20 aria-[current=page]:text-cream-50"
                  >
                    {cat ?? "همه"}
                  </Link>
                ))}
              </nav>
            </div>

            {!loading && (
              <div className="min-w-0 border-t border-gold-500/25 pt-3 md:border-s md:border-t-0 md:ps-5 md:pt-0">
                <label
                  htmlFor="shop-weight"
                  className="mb-2.5 block text-sm font-semibold text-cream-100"
                >
                  وزن بسته
                </label>
                <div className="flex items-start gap-2">
                  <Select.Root
                    dir="rtl"
                    value={selectedKey}
                    onValueChange={(value) => {
                      const choice = weightChoices.find(
                        (weight) => weightChoiceKey(weight) === value,
                      );
                      navigate(weightHref(choice ?? null));
                    }}
                  >
                    <Select.Trigger
                      id="shop-weight"
                      className="group flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-xl border border-gold-500/50 bg-ink-900 px-3 py-2 text-start text-sm font-medium text-cream-100 transition-colors hover:border-gold-600 data-[state=open]:border-gold-600"
                    >
                      <Select.Value>
                        {
                          weightOptions.find(
                            ({ value }) => value === selectedKey,
                          )?.label
                        }
                      </Select.Value>
                      <Select.Icon asChild>
                        <ChevronDown className="size-4 shrink-0 text-accent transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content
                        position="popper"
                        align="start"
                        sideOffset={6}
                        collisionPadding={{
                          top: 88,
                          right: 8,
                          bottom: 8,
                          left: 8,
                        }}
                        className="z-50 flex max-h-[var(--radix-select-content-available-height)] w-[var(--radix-select-trigger-width)] flex-col overflow-hidden rounded-xl border border-gold-600/60 bg-ink-700 text-cream-100 shadow-lg"
                      >
                        <Select.ScrollUpButton className="flex min-h-7 items-center justify-center text-accent">
                          <ChevronUp aria-hidden="true" className="size-4" />
                        </Select.ScrollUpButton>
                        <Select.Viewport className="space-y-1 p-1.5">
                          {weightOptions.map(({ value, label, disabled }) => (
                            <Select.Item
                              key={value}
                              value={value}
                              disabled={disabled}
                              className="relative flex min-h-11 cursor-pointer select-none items-center rounded-lg px-2.5 py-2 pe-8 text-start text-sm data-[disabled]:cursor-default data-[disabled]:text-cream-400 data-[highlighted]:bg-gold-500/25 data-[highlighted]:outline-2 data-[highlighted]:-outline-offset-2 data-[highlighted]:outline-accent data-[state=checked]:bg-gold-500/15 data-[state=checked]:font-semibold"
                            >
                              <Select.ItemText>{label}</Select.ItemText>
                              <Select.ItemIndicator className="absolute end-2.5 flex items-center text-accent">
                                <Check aria-hidden="true" className="size-4" />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                        <Select.ScrollDownButton className="flex min-h-7 items-center justify-center text-accent">
                          <ChevronDown aria-hidden="true" className="size-4" />
                        </Select.ScrollDownButton>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                  {selectedWeight && (
                    <Link
                      href={weightHref(null)}
                      aria-label="پاک کردن فیلتر وزن"
                      title="پاک کردن فیلتر وزن"
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold-500/30 text-accent transition-colors hover:border-gold-600 hover:bg-gold-500/10"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2
                className="h-8 w-8 animate-spin text-accent"
                strokeWidth={1.5}
              />
            </div>
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
