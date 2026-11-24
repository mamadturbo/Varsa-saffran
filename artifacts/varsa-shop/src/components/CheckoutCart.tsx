import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useCart } from "@/lib/cart";
import { useShippingInfo } from "@/lib/store-content";
import { formatPrice, toFaDigits } from "@/lib/site";
import { MAX_PRODUCT_QUANTITY, MAX_ORDER_LINES } from "@workspace/validation";
import { DeliveryImage } from "./DeliveryImage";

export function CheckoutCart({ onContinue }: { onContinue: () => void }) {
  const shipping = useShippingInfo();
  const { items, remove, setQty, total, count, clear } = useCart();

  return (
    <>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 border-t border-gold-500/20 py-12 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-gold-500/20 bg-gold-500/5">
            <ShoppingBag
              className="h-8 w-8 text-gold-500/50"
              strokeWidth={1.2}
            />
          </div>
          <p className="text-cream-200">سبد خرید شما خالی است</p>
          <Link href="/shop" className="btn-gold mt-2">
            مشاهده فروشگاه
          </Link>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
          <div className="min-w-0 space-y-3">
            <p className="mb-3 text-sm text-cream-300">
              {toFaDigits(count)} کالا در سبد خرید
            </p>
            {items.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="flex gap-4 rounded-xl border border-gold-500/15 bg-white/[0.02] p-3"
              >
                <DeliveryImage
                  src={product.image_url}
                  alt={product.name}
                  className="h-16 w-16 flex-shrink-0 rounded-lg object-cover sm:h-20 sm:w-20"
                  loading="lazy"
                  sizes="(min-width: 640px) 80px, 64px"
                  crop="square"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-medium leading-6 text-cream-100">
                      {product.name}
                    </h2>
                    <button
                      onClick={() => remove(product.id)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center text-cream-500 transition-colors hover:text-crimson-400"
                      aria-label={`حذف ${product.name}`}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                  <span className="mt-0.5 text-xs text-accent">
                    {product.category}
                  </span>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                    <div className="flex items-center gap-1 rounded-full border border-gold-500/25">
                      <button
                        onClick={() => setQty(product.id, quantity - 1)}
                        className="flex h-11 w-11 items-center justify-center text-accent transition-colors hover:text-accent"
                        aria-label={`کاهش تعداد ${product.name}`}
                      >
                        <Minus className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                      <span
                        aria-live="polite"
                        aria-atomic="true"
                        className="w-6 text-center text-sm text-cream-100"
                      >
                        {toFaDigits(quantity)}
                      </span>
                      <button
                        onClick={() => setQty(product.id, quantity + 1)}
                        disabled={quantity >= MAX_PRODUCT_QUANTITY}
                        className="flex h-11 w-11 items-center justify-center text-accent transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label={`افزایش تعداد ${product.name}`}
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-price">
                      {formatPrice(product.price * quantity)}
                    </span>
                  </div>
                  {quantity >= MAX_PRODUCT_QUANTITY && (
                    <p className="mt-2 text-xs text-cream-400">
                      حداکثر تعداد این محصول در سبد:{" "}
                      {toFaDigits(MAX_PRODUCT_QUANTITY)} عدد
                    </p>
                  )}
                </div>
              </div>
            ))}

            <button
              onClick={() => clear()}
              className="mx-auto flex min-h-11 items-center gap-2 px-3 text-xs text-cream-500 transition-colors hover:text-crimson-400"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              خالی کردن سبد
            </button>
          </div>

          <section
            aria-label="جمع سبد خرید"
            className="rounded-2xl border border-gold-500/20 bg-gold-500/5 p-4 sm:p-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-cream-300">جمع کالاها</span>
              <span className="text-lg font-bold text-price">
                {formatPrice(total)}
              </span>
            </div>
            <p className="mb-4 rounded-lg bg-gold-500/5 px-3 py-2 text-center text-xs text-cream-400">
              {shipping}
            </p>
            <p className="mb-3 text-center text-xs text-cream-400">
              حداکثر {toFaDigits(MAX_PRODUCT_QUANTITY)} عدد از هر محصول و{" "}
              {toFaDigits(MAX_ORDER_LINES)} محصول در هر سفارش
            </p>
            <button onClick={onContinue} className="btn-solid w-full">
              ادامه به اطلاعات ارسال
            </button>
            <Link href="/shop" className="btn-ghost mt-2 w-full">
              ادامه خرید
            </Link>
          </section>
        </div>
      )}
    </>
  );
}
