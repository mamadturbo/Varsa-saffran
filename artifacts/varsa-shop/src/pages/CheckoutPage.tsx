import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, Redirect, useLocation } from "wouter";
import { MapPin, Pencil, ShoppingBag } from "lucide-react";
import type {
  Customer,
  CustomerAddress,
  OrderPricing,
} from "@workspace/catalog";
import { reconcileCart } from "@workspace/catalog";
import { CheckoutCart } from "@/components/CheckoutCart";
import { DeliveryImage } from "@/components/DeliveryImage";
import { measureCommerce } from "@/lib/analytics";
import { fetchProducts } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { useCustomer } from "@/lib/customer";
import { quoteOrder } from "@/lib/management-api";
import { getOrderSubmitErrorMessage } from "@/lib/order-receipt";
import { getApiErrorMessage, submitOrder } from "@/lib/orders-api";
import { rememberPayment } from "@/lib/payment-api";
import {
  CHECKOUT_PATHS,
  CHECKOUT_TITLES,
  type CheckoutStage,
} from "@/lib/routes";
import { formatPrice, toFaDigits } from "@/lib/site";
import { CustomerLogin } from "./CustomerLogin";

const stages = ["register", "cart", "shipping", "review", "payment"] as const;
const titles = { ...CHECKOUT_TITLES, payment: "پرداخت" };

type Delivery = { name: string; address: string; addressId: string };

function savedDelivery(address: CustomerAddress): Delivery {
  return {
    name: address.recipient,
    address: `${address.province}، ${address.city}، ${address.address}، کد پستی ${address.postalCode}، گیرنده ${address.recipient} (${address.phone})`,
    addressId: address.id,
  };
}

function CheckoutLayout({
  stage,
  children,
}: {
  stage: CheckoutStage;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), [stage]);

  return (
    <main
      dir="rtl"
      className="container-luxe min-h-[70vh] pb-16 pt-28 sm:pt-32"
    >
      <div className="mx-auto max-w-5xl">
        <nav aria-label="مراحل خرید">
          <ol className="mb-7 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
            {stages.map((step, index) => (
              <li
                key={step}
                aria-current={step === stage ? "step" : undefined}
                className={`flex items-center gap-2 border-b-2 py-2 text-xs sm:text-sm ${step === stage ? "border-gold-500 font-bold text-accent" : "border-gold-500/20 text-cream-400"}`}
              >
                <span aria-hidden="true">{toFaDigits(index + 1)}</span>
                {titles[step]}
              </li>
            ))}
          </ol>
        </nav>
        <h1
          ref={heading}
          tabIndex={-1}
          className={`mb-6 font-display text-2xl font-bold text-cream-50 sm:text-3xl ${stage === "register" ? "text-center" : ""}`}
        >
          {titles[stage]}
        </h1>
        {children}
      </div>
    </main>
  );
}

export function CheckoutPage({ stage }: { stage: CheckoutStage }) {
  const account = useCustomer();
  const cart = useCart();
  const [, navigate] = useLocation();
  const [draft, setDraft] = useState<{
    customerId: Customer["id"];
    delivery: Delivery;
  }>();
  const [coupon, setCoupon] = useState("");
  const delivery =
    draft?.customerId === account.customer?.id ? draft?.delivery : undefined;

  if (!cart.attemptId || (cart.items.length > 0 && !account.ready)) {
    return (
      <CheckoutLayout stage={stage}>
        <p role="status" className="text-cream-200">
          در حال دریافت اطلاعات خرید…
        </p>
      </CheckoutLayout>
    );
  }
  if (cart.items.length === 0 && stage !== "cart")
    return <Redirect to={CHECKOUT_PATHS.cart} replace />;
  if (cart.items.length > 0 && !account.customer && stage !== "register") {
    return <Redirect to={CHECKOUT_PATHS.register} replace />;
  }
  if (stage === "register" && account.customer)
    return <Redirect to={CHECKOUT_PATHS.cart} replace />;
  if (stage === "review" && !delivery)
    return <Redirect to={CHECKOUT_PATHS.shipping} replace />;

  return (
    <CheckoutLayout stage={stage}>
      {stage === "register" && (
        <div className="mx-auto w-full max-w-md">
          {account.error && (
            <p
              role="alert"
              className="mb-4 text-sm text-crimson-700 dark:text-crimson-300"
            >
              ارتباط با حساب برقرار نشد.
            </p>
          )}
          <CustomerLogin checkout />
        </div>
      )}
      {stage === "cart" && (
        <CheckoutCart
          onContinue={() => {
            measureCommerce("begin_checkout", cart.items);
            navigate(CHECKOUT_PATHS.shipping);
          }}
        />
      )}
      {stage === "shipping" && account.customer && (
        <ShippingForm
          customer={account.customer}
          initial={delivery}
          onContinue={(value) => {
            setDraft({ customerId: account.customer!.id, delivery: value });
            navigate(CHECKOUT_PATHS.review);
          }}
        />
      )}
      {stage === "review" && account.customer && delivery && (
        <OrderReview
          delivery={delivery}
          phone={account.customer.phone}
          coupon={coupon}
          onCoupon={setCoupon}
        />
      )}
    </CheckoutLayout>
  );
}

function ShippingForm({
  customer,
  initial,
  onContinue,
}: {
  customer: Customer;
  initial?: Delivery;
  onContinue: (delivery: Delivery) => void;
}) {
  const addresses = customer.profile.addresses;
  const [delivery, setDelivery] = useState<Delivery>(() => {
    if (initial) return initial;
    const address = addresses.find((item) => item.isDefault) ?? addresses[0];
    return address
      ? savedDelivery(address)
      : { name: customer.profile.name, address: "", addressId: "" };
  });
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const name = delivery.name.trim();
    const address = delivery.address.trim();
    if (!name || !address) {
      setError("نام گیرنده و نشانی پستی را وارد کنید.");
      return;
    }
    onContinue({ ...delivery, name, address });
  }

  return (
    <form
      onSubmit={submit}
      className="max-w-xl space-y-5 border-t border-gold-500/20 pt-5"
    >
      {addresses.length > 0 && (
        <div>
          <label className="label-luxe" htmlFor="ck-saved-address">
            آدرس‌های ذخیره‌شده
          </label>
          <select
            id="ck-saved-address"
            className="input-luxe"
            value={delivery.addressId}
            onChange={(event) => {
              const address = addresses.find(
                (item) => item.id === event.target.value,
              );
              setDelivery(
                address
                  ? savedDelivery(address)
                  : { name: customer.profile.name, address: "", addressId: "" },
              );
            }}
          >
            <option value="">وارد کردن آدرس</option>
            {addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {address.label}، {address.city}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label-luxe" htmlFor="ck-name">
          نام و نام خانوادگی گیرنده
        </label>
        <input
          id="ck-name"
          className="input-luxe"
          autoComplete="name"
          required
          maxLength={120}
          value={delivery.name}
          onChange={(event) =>
            setDelivery({
              ...delivery,
              name: event.target.value,
              addressId: "",
            })
          }
        />
      </div>
      <div>
        <label className="label-luxe" htmlFor="ck-phone">
          شماره موبایل تأییدشده
        </label>
        <input
          id="ck-phone"
          className="input-luxe text-right"
          dir="ltr"
          type="tel"
          readOnly
          value={customer.phone}
        />
      </div>
      <div>
        <label className="label-luxe" htmlFor="ck-address">
          نشانی پستی
        </label>
        <textarea
          id="ck-address"
          className="input-luxe"
          rows={4}
          autoComplete="street-address"
          required
          maxLength={1000}
          value={delivery.address}
          onChange={(event) =>
            setDelivery({
              ...delivery,
              address: event.target.value,
              addressId: "",
            })
          }
        />
      </div>
      {error && <CheckoutError>{error}</CheckoutError>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-solid">
          ادامه به بازبینی سفارش
        </button>
        <Link className="btn-ghost" href={CHECKOUT_PATHS.cart}>
          بازگشت به سبد خرید
        </Link>
      </div>
    </form>
  );
}

function CheckoutError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-crimson-500/30 bg-crimson-500/10 p-3 text-sm leading-6 text-crimson-700 dark:text-crimson-300"
    >
      {children}
    </p>
  );
}

function OrderReview({
  delivery,
  phone,
  coupon,
  onCoupon,
}: {
  delivery: Delivery;
  phone: string;
  coupon: string;
  onCoupon: (code: string) => void;
}) {
  const { items, attemptId, total, clear, replaceItems } = useCart();
  const [, navigate] = useLocation();
  const [couponInput, setCouponInput] = useState(coupon);
  const [priced, setPriced] = useState<{
    items: typeof items;
    coupon: string;
    value: OrderPricing;
  }>();
  const [quoteError, setQuoteError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const submitting = useRef(false);
  const quote =
    priced?.items === items && priced.coupon === coupon
      ? priced.value
      : undefined;

  useEffect(() => {
    let active = true;
    setQuoteError("");
    quoteOrder(
      items.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
      })),
      coupon,
    )
      .then((value) => {
        if (active) setPriced({ items, coupon, value });
      })
      .catch((error) => {
        if (active)
          setQuoteError(
            getApiErrorMessage(error, "دریافت مبلغ سفارش انجام نشد."),
          );
      });
    return () => {
      active = false;
    };
  }, [items, coupon, retry]);

  function applyCoupon(code: string) {
    setCouponInput(code);
    if (code === coupon) return;
    setPriced(undefined);
    setSubmitError("");
    onCoupon(code);
  }

  async function submit() {
    if (submitting.current || !quote) return;
    submitting.current = true;
    setBusy(true);
    setSubmitError("");
    try {
      const refreshed = reconcileCart(items, await fetchProducts());
      if (refreshed.missingIds.length) {
        throw new Error(
          "بعضی محصولات دیگر موجود نیستند. آن‌ها را از سبد حذف کنید.",
        );
      }
      if (refreshed.changed) {
        replaceItems(refreshed.items, items);
        setSubmitError("اطلاعات سبد به‌روز شد. قیمت‌ها را دوباره بررسی کنید.");
        return;
      }
      const lines = items.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
      }));
      const freshQuote = await quoteOrder(lines, coupon);
      if (JSON.stringify(freshQuote) !== JSON.stringify(quote)) {
        setPriced({ items, coupon, value: freshQuote });
        setSubmitError(
          "مبلغ سفارش به‌روز شد. هزینه ارسال و تخفیف را دوباره بررسی کنید.",
        );
        return;
      }
      const receipt = await submitOrder({
        idempotencyKey: attemptId,
        customerName: delivery.name,
        phone,
        address: delivery.address,
        expectedTotal: freshQuote.total,
        couponCode: coupon,
        items: lines,
      });
      rememberPayment(receipt, attemptId);
      measureCommerce("order_request_submitted", items);
      clear({ attemptId, items });
      navigate(`/payment/${encodeURIComponent(receipt.id)}`, { replace: true });
    } catch (error) {
      setSubmitError(getOrderSubmitErrorMessage(error));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="min-w-0 space-y-4">
        <section
          aria-labelledby="review-items"
          className="rounded-2xl border border-gold-500/25 bg-surface-tint-soft p-4 text-sm leading-7 text-cream-200 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold-500/20 pb-3">
            <h2
              id="review-items"
              className="flex items-center gap-2 text-base font-bold text-cream-50"
            >
              <ShoppingBag
                aria-hidden="true"
                size={20}
                className="text-accent"
              />
              کالاهای سفارش
            </h2>
            <button
              type="button"
              disabled={busy}
              onClick={() => navigate(CHECKOUT_PATHS.cart)}
              className="btn-gold min-h-11 !px-4 !py-2 disabled:opacity-50"
            >
              <Pencil aria-hidden="true" size={15} />
              ویرایش سبد خرید
            </button>
          </div>
          <ul className="divide-y divide-gold-500/15">
            {items.map(({ product, quantity }) => (
              <li
                key={product.id}
                className="flex items-center gap-3 py-3 last:pb-0"
              >
                <DeliveryImage
                  src={product.image_url}
                  alt=""
                  sizes="56px"
                  crop="square"
                  loading="lazy"
                  className="h-14 w-14 shrink-0 rounded-xl border border-gold-500/20 object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <p className="font-semibold text-cream-50">
                      {product.name}
                    </p>
                    <p className="text-xs text-cream-400">
                      {toFaDigits(quantity)} عدد
                    </p>
                  </div>
                  <span className="font-semibold text-price">
                    {formatPrice(product.price * quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section
          aria-labelledby="review-address"
          className="rounded-2xl border border-gold-500/25 bg-surface-tint-soft p-4 text-sm leading-7 text-cream-200 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold-500/20 pb-3">
            <h2
              id="review-address"
              className="flex items-center gap-2 text-base font-bold text-cream-50"
            >
              <MapPin aria-hidden="true" size={20} className="text-accent" />
              نشانی ارسال
            </h2>
            <button
              type="button"
              disabled={busy}
              onClick={() => navigate(CHECKOUT_PATHS.shipping)}
              className="btn-gold min-h-11 !px-4 !py-2 disabled:opacity-50"
            >
              <Pencil aria-hidden="true" size={15} />
              ویرایش اطلاعات ارسال
            </button>
          </div>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <dt className="text-xs text-cream-400">گیرنده</dt>
              <dd className="font-semibold text-cream-50">{delivery.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-cream-400">شماره موبایل</dt>
              <dd className="font-semibold text-cream-50">
                <bdi dir="ltr">{toFaDigits(phone)}</bdi>
              </dd>
            </div>
            <div className="w-full">
              <dt className="text-xs text-cream-400">نشانی پستی</dt>
              <dd className="wrap-break-word whitespace-pre-wrap">
                {delivery.address}
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <section
        aria-label="مبلغ سفارش"
        className="min-w-0 space-y-4 rounded-2xl border border-gold-500/20 bg-gold-500/5 p-4 text-sm text-cream-200 sm:p-5"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applyCoupon(couponInput.trim().toUpperCase());
          }}
        >
          <label htmlFor="ck-coupon" className="label-luxe">
            کد تخفیف
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="ck-coupon"
              className="input-luxe min-w-0 flex-1 basis-24 text-end"
              dir="ltr"
              maxLength={50}
              disabled={busy}
              value={couponInput}
              onChange={(event) => setCouponInput(event.target.value)}
            />
            <button type="submit" className="btn-gold !px-4" disabled={busy}>
              اعمال
            </button>
            {coupon && (
              <button
                type="button"
                className="btn-ghost !px-3"
                disabled={busy}
                onClick={() => applyCoupon("")}
              >
                حذف
              </button>
            )}
          </div>
        </form>
        <dl className="space-y-3 tabular-nums">
          <div className="flex flex-wrap justify-between gap-x-3">
            <dt>جمع کالاها</dt>
            <dd>{formatPrice(total)}</dd>
          </div>
          {quote && (
            <>
              {quote.couponCode && (
                <div className="flex flex-wrap justify-between gap-x-3">
                  <dt>تخفیف</dt>
                  <dd>{formatPrice(quote.discount)}</dd>
                </div>
              )}
              <div className="flex flex-wrap justify-between gap-x-3">
                <dt>هزینه ارسال</dt>
                <dd>
                  {quote.shippingConfigured
                    ? formatPrice(quote.shipping)
                    : "هنوز تعیین نشده"}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 border-t border-gold-500/20 pt-3 font-bold">
                <dt>مبلغ سفارش</dt>
                <dd className="text-price">{formatPrice(quote.total)}</dd>
              </div>
            </>
          )}
        </dl>
        {quoteError ? (
          <>
            <CheckoutError>{quoteError}</CheckoutError>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setRetry((value) => value + 1)}
            >
              محاسبه دوباره مبلغ
            </button>
          </>
        ) : (
          !quote && <p role="status">در حال محاسبه مبلغ سفارش…</p>
        )}
        {submitError && <CheckoutError>{submitError}</CheckoutError>}
        <button
          type="button"
          className="btn-solid w-full disabled:opacity-50"
          disabled={busy || !quote || Boolean(quoteError)}
          onClick={() => void submit()}
        >
          {busy ? "در حال ثبت سفارش…" : "ثبت سفارش و ادامه به پرداخت"}
        </button>
        {busy && (
          <span role="status" className="sr-only">
            در حال ثبت سفارش
          </span>
        )}
      </section>
    </div>
  );
}
