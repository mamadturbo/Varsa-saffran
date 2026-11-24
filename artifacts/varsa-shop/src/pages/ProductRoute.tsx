import { useEffect, useRef } from "react";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import {
  useAssetOrigin,
  usePublicPage,
  useRawSearch,
} from "@/lib/page-context";
import {
  forgetDialogTrigger,
  rememberedDialogTrigger,
  restoreDialogFocus,
} from "@/lib/dialog-focus";
import { readShopCategory, shopListingHref } from "@/lib/shop-filter";
import type { Product } from "@/lib/types";
import { useBuyProduct } from "@/lib/cart";
import { formatPrice, formatWeight } from "@/lib/site";
import { useShippingInfo } from "@/lib/store-content";
import { isBrandArtworkUrl } from "@/lib/brand-artwork";
import { productPath, categoryPath, guidePath, pagePath } from "@/lib/routes";
import { categoryPackages } from "@/lib/product-comparison";
import { UnitPrice } from "@/components/UnitPrice";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { DeliveryImage } from "@/components/DeliveryImage";
import { FavoriteButton, ProductReviews } from "@/components/CustomerTools";
import { productSummary, representativeProducts, representativeSelection } from "@/lib/representative-products";

export function ProductRoute({ product }: { product: Product }) {
  const shipping = useShippingInfo();
  const { data } = usePublicPage();
  const buy = useBuyProduct();
  const search = useRawSearch();
  const origin = useAssetOrigin();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const products = data.products ?? [];
  const related = categoryPackages(products, product).filter(
    (option) => option.id !== product.id,
  );
  const selection = representativeSelection(product);
  const alternatives = selection ? representativeProducts(products).filter(option => option.id !== product.id) : [];
  const returnHref = search
    ? shopListingHref(readShopCategory(search), search)
    : (categoryPath(product.category) ?? "/shop");
  const illustrated = isBrandArtworkUrl(
    product.image_url,
    `${origin}${import.meta.env.BASE_URL}`,
  );

  useEffect(() => {
    const trigger = rememberedDialogTrigger("product-dialog");
    if (trigger) titleRef.current?.focus({ preventScroll: true });
    return () => {
      if (!/\/products\/[^/]+$/.test(window.location.pathname)) {
        restoreDialogFocus(trigger);
        forgetDialogTrigger("product-dialog");
      }
    };
  }, []);

  return (
    <main className="container-luxe pb-16 pt-32">
      <PageBreadcrumbs />
      <Link
        href={returnHref}
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-accent"
      >
        <ArrowRight aria-hidden="true" className="h-4 w-4" /> بازگشت به فهرست
        محصولات
      </Link>
      <section
        aria-labelledby="product-title"
        className="grid grid-cols-1 overflow-hidden rounded-3xl border border-gold-500/25 bg-ink-900 shadow-2xl lg:grid-cols-2"
      >
        {/* Image */}
        <div className="relative aspect-[4/3] sm:aspect-[16/10] lg:sticky lg:top-0 lg:aspect-square lg:self-start">
          <DeliveryImage
            src={product.image_url}
            alt={illustrated ? `تصویرسازی ${product.name}` : product.name}
            width={illustrated ? 1254 : undefined}
            height={illustrated ? 1254 : undefined}
            sizes={
              illustrated
                ? "(min-width: 1024px) 600px, (min-width: 640px) calc(62.5vw - 30px), calc(75vw - 24px)"
                : "(min-width: 1024px) 600px, (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
            }
            loading="eager"
            fetchPriority="high"
            className={`h-full w-full ${illustrated ? "object-contain" : "object-cover"}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900/40 to-transparent lg:bg-gradient-to-l" />
          <span className="absolute right-4 top-4 chip backdrop-blur-sm">
            {product.category}
          </span>
          {illustrated && (
            <p className="absolute inset-x-0 bottom-0 bg-ink-900 px-4 py-2 text-center text-xs text-cream-400">
              تصویرسازی بسته‌بندی ورسا
            </p>
          )}
        </div>

        {/* Details */}
        <div className="flex min-w-0 flex-col p-4 sm:p-8">
          <h1
            id="product-title"
            ref={titleRef}
            tabIndex={-1}
            className="font-display text-2xl font-bold text-cream-50"
          >
            {product.name}
          </h1>
          <p className="mt-3 text-sm leading-7 text-cream-300 text-pretty">
            {productSummary(product)}
          </p>

          {product.short_description &&
            product.long_description &&
            product.short_description !== product.long_description && (
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-cream-300">
                {product.long_description}
              </p>
            )}

          {selection && (
            <section className="mt-6 rounded-2xl border border-gold-500/20 bg-gold-500/[0.04] p-4" aria-labelledby="product-cut">
              <h2 id="product-cut" className="text-sm font-semibold text-cream-100">برش {product.category} در بازار</h2>
              <p className="mt-2 text-sm leading-7 text-cream-300">{selection.cut}</p>
              <a href={selection.source.url} className="inline-flex min-h-11 items-center text-xs text-accent underline underline-offset-4">{selection.source.label}</a>
            </section>
          )}

          <ul className="mt-2 flex flex-wrap gap-x-4 text-xs text-accent">
            <li><Link href={guidePath("check-saffron")} className="inline-flex min-h-11 items-center underline underline-offset-4">راهنمای بررسی اصالت</Link></li>
            {selection && <>
              <li><Link href={guidePath("brew-saffron")} className="inline-flex min-h-11 items-center underline underline-offset-4">روش دم‌کردن</Link></li>
              <li><Link href={guidePath("store-saffron")} className="inline-flex min-h-11 items-center underline underline-offset-4">روش نگهداری</Link></li>
            </>}
          </ul>

          {/* Weight & price */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-cream-400">وزن خالص</p>
              <p className="text-base font-semibold text-cream-100">
                {formatWeight(product.weight, product.weight_unit)}
              </p>
            </div>
            <div className="text-start">
              <p className="text-xs text-cream-400">قیمت</p>
              <p className="text-2xl font-bold text-price">
                {formatPrice(product.price)}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <UnitPrice product={product} />
          </div>

          <div className="mt-auto pt-8">
            <div className="mb-4 flex justify-end">
              <FavoriteButton productId={product.id} />
            </div>
            <div className="flex gap-3">
              <button
                disabled={product.stock === 0 || product.active === false}
                onClick={() => buy(product)}
                className="btn-solid flex-1"
              >
                <ShoppingBag className="h-4 w-4" strokeWidth={1.8} />
                {product.stock === 0 || product.active === false ? "ناموجود" : "خرید محصول"}
              </button>
            </div>
            {typeof product.stock === "number" && (
              <p className="mt-4 text-center text-sm text-cream-200">
                {product.stock === 0 ? "ناموجود" : "موجود"}
              </p>
            )}
            <p className="mt-4 text-center text-xs leading-6 text-cream-400">
              {shipping}
            </p>
            <Link href={pagePath("contact")} className="mx-auto flex min-h-11 w-fit items-center text-xs text-accent underline underline-offset-4">
              ارسال، پیگیری و درخواست مرجوعی
            </Link>
          </div>

          {alternatives.length > 0 && (
            <section className="mt-6" aria-labelledby="compare-mesghal">
              <h2 id="compare-mesghal" className="text-sm font-semibold text-cream-100">مقایسه با بسته‌های یک‌مثقالی دیگر</h2>
              <ul className="mt-2 space-y-1">
                {alternatives.map(option => (
                  <li key={option.id}>
                    <Link href={productPath(option.slug)} className="flex min-h-11 flex-wrap items-center justify-between gap-x-2 py-2 text-sm text-accent underline underline-offset-4">
                      <span>{option.name}</span>
                      <span>{formatPrice(option.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {related.length > 0 && (
            <section className="mt-6" aria-labelledby="category-packages">
              <h2
                id="category-packages"
                className="text-sm font-semibold text-cream-100"
              >
                بسته‌های این دسته
              </h2>
              <p className="mt-2 text-xs leading-6 text-cream-300">
                هر گزینه محصول مستقلی است؛ نام، وزن و محتویات بسته را پیش از
                انتخاب بررسی کنید.
              </p>
              <div className="mt-3 grid gap-2">
                {related.map((option) => (
                  <Link
                    key={option.id}
                    href={productPath(option.slug)}
                    className="min-h-11 rounded-xl border border-gold-500/25 px-3 py-2 text-sm leading-6 text-cream-200 hover:border-gold-600"
                  >
                    <span className="block">{option.name}</span>
                    <span className="block text-xs text-cream-300">
                      {formatWeight(option.weight, option.weight_unit)} ·{" "}
                      {formatPrice(option.price)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <ProductReviews productId={product.id} />
        </div>
      </section>
    </main>
  );
}
