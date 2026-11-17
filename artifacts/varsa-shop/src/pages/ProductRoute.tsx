import { Link, useLocation } from "wouter";
import { useSearch } from "wouter/use-browser-location";
import { readShopCategory, shopCategoryHref } from "@/lib/shop-filter";
import { fetchProducts } from "@/lib/api";
import { useAsyncData } from "@/lib/hooks-extra";
import { lastPathSegment } from "@/lib/routes";
import { ProductModal } from "@/components/ProductModal";
import { forgetDialogTrigger } from '@/lib/dialog-focus';
import { useEffect } from 'react';
export function ProductRoute() {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const returnHref = shopCategoryHref(readShopCategory(search), search);
  const slug = lastPathSegment(window.location.pathname);
  useEffect(() => () => {
    if (!/\/products\/[^/]+\/?$/.test(window.location.pathname)) forgetDialogTrigger('product-dialog');
  }, []);
  const {
    data: products,
    loading,
    error,
  } = useAsyncData(async () => {
    return fetchProducts();
  }, [location]);
  const product = products?.find(item => item.slug === slug);
  if (loading)
    return (
      <main className="min-h-[65vh] pt-36 text-center" role="status">
        در حال دریافت محصول...
      </main>
    );
  if (error || !product)
    return (
      <main className="container-luxe min-h-[65vh] pt-36 pb-20 text-center">
        <h1 className="text-2xl font-bold text-cream-50">
          {error ? "دریافت محصول انجام نشد" : "محصول پیدا نشد"}
        </h1>
        <p className="mt-4 text-sm text-cream-300">
          {error
            ? "لطفاً کمی بعد صفحه را دوباره بارگذاری کنید."
            : "این محصول در کاتالوگ فعلی وجود ندارد."}
        </p>
        <Link href={returnHref} className="btn-solid mt-8">
          بازگشت به فروشگاه
        </Link>
      </main>
    );
  return (
    <main className="min-h-[70vh] pt-32">
      <ProductModal product={product} products={products ?? []} onClose={() => { forgetDialogTrigger('product-dialog'); navigate(returnHref); }} />
    </main>
  );
}
