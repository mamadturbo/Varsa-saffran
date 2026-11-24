import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Loader2, RefreshCw, Upload } from "lucide-react";
import {
  paymentKey,
  paymentRequest,
  receiptData,
  rememberedOrder,
  type PaymentView,
} from "@/lib/payment-api";
import { getApiErrorMessage } from "@/lib/orders-api";
import { formatPrice } from "@/lib/site";
import { ORDER_RECEIPT_STATUS } from "@/lib/order-receipt";

export function CardTransferPayment({ orderId }: { orderId: string }) {
  const key = paymentKey(orderId);
  const [view, setView] = useState<PaymentView | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const uploading = useRef(false);
  const refresh = useCallback(async () => {
    const result = await paymentRequest<PaymentView>(orderId, key);
    setView(result);
  }, [orderId, key]);
  useEffect(() => {
    let active = true;
    paymentRequest<PaymentView>(orderId, key)
      .then((result) => {
        if (active) setView(result);
      })
      .catch((e) => {
        if (active)
          setError(getApiErrorMessage(e, "دریافت اطلاعات پرداخت انجام نشد."));
      });
    return () => {
      active = false;
    };
  }, [orderId, key]);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (view?.receipt?.status !== "pending") return;
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh().catch(() => {});
    }, 10000);
    return () => window.clearInterval(interval);
  }, [view?.receipt?.status, refresh]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || uploading.current) return;
    uploading.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await paymentRequest(orderId, key, "/receipt", await receiptData(file));
      await refresh();
      setFile(null);
      setNotice(
        "رسید ثبت شد و برای بررسی پرداخت ارسال می‌شود. تا تأیید فروشگاه، پرداخت در انتظار بررسی است.",
      );
    } catch (e) {
      setError(
        getApiErrorMessage(
          e,
          "پاسخ قطعی دریافت نشد. ابتدا وضعیت را به‌روز کنید؛ سپس در صورت نیاز دوباره ارسال کنید.",
        ),
      );
      void refresh().catch(() => {});
    } finally {
      uploading.current = false;
      setBusy(false);
    }
  }
  const approved = view?.paymentStatus === "paid";
  const order = view?.order ?? rememberedOrder(orderId);
  const orderStatus = order && ORDER_RECEIPT_STATUS[order.status];
  const pending = view?.receipt?.status === "pending";
  const payable =
    view &&
    (view.canSubmitReceipt ?? view.order.status === "pending") &&
    view.shippingConfigured &&
    !approved &&
    !pending;
  return (
    <section
      className="w-full space-y-4 text-right text-sm leading-7 text-cream-200"
      aria-label="پرداخت کارت‌به‌کارت"
    >
      {order && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-cream-50">
            {orderStatus?.title ?? "وضعیت سفارش"}
          </h2>
          {orderStatus && <p>{orderStatus.message}</p>}
          <dl className="space-y-2 rounded-xl border border-gold-500/25 bg-gold-500/5 p-4">
            <div className="flex flex-wrap justify-between gap-x-4">
              <dt>کد سفارش</dt>
              <dd dir="ltr" className="select-all font-bold text-accent">
                {order.orderNumber}
              </dd>
            </div>
            {orderStatus && (
              <div className="flex flex-wrap justify-between gap-x-4">
                <dt>وضعیت سفارش</dt>
                <dd>{orderStatus.label}</dd>
              </div>
            )}
            <div className="flex flex-wrap justify-between gap-x-4">
              <dt>مبلغ سفارش</dt>
              <dd className="font-bold text-price">
                {formatPrice(order.total)}
              </dd>
            </div>
          </dl>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-crimson-500/40 p-3 text-crimson-500"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl border border-gold-500/30 p-3">
          {notice}
        </p>
      )}
      {!view ? (
        <button
          type="button"
          className="btn-gold min-h-11"
          onClick={() =>
            void refresh().catch((e) =>
              setError(getApiErrorMessage(e, "دریافت اطلاعات انجام نشد.")),
            )
          }
        >
          دریافت اطلاعات پرداخت
        </button>
      ) : (
        <>
          <button
            type="button"
            aria-label="به‌روزرسانی وضعیت پرداخت"
            className="flex min-h-11 items-center gap-2 text-accent"
            onClick={() =>
              void refresh().catch((e) =>
                setError(getApiErrorMessage(e, "به‌روزرسانی انجام نشد.")),
              )
            }
          >
            <RefreshCw size={18} />
            به‌روزرسانی
          </button>
          {approved ? (
            <p
              role="status"
              className="rounded-xl border border-gold-500/40 p-4"
            >
              پرداخت شما تأیید شد. وضعیت سفارش را در حساب خود ببینید.
            </p>
          ) : pending ? (
            <>
              <p
                role="status"
                className="rounded-xl border border-gold-500/30 p-4"
              >
                رسید دریافت شد؛ پرداخت در انتظار بررسی فروشگاه است. دوباره واریز
                نکنید.
              </p>
              {view.receipt?.deliveryStatus === "failed" && (
                <div>
                  <p>
                    اطلاع‌رسانی به فروشگاه با مشکل روبه‌رو شده است؛ رسید شما
                    محفوظ است.
                  </p>
                  <button
                    type="button"
                    className="btn-gold min-h-11"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await paymentRequest(orderId, key, "/retry", {});
                        await refresh();
                      } catch (e) {
                        setError(getApiErrorMessage(e, "تلاش مجدد انجام نشد."));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    تلاش مجدد برای اطلاع‌رسانی
                  </button>
                </div>
              )}
            </>
          ) : !view.config.enabled ? (
            <p
              role="status"
              className="rounded-xl border border-gold-500/30 p-4"
            >
              پرداخت کارت‌به‌کارت هنوز فعال نشده است. سفارش ثبت شده؛ فعلاً واریز
              نکنید و برای هماهنگی با فروشگاه تماس بگیرید.
            </p>
          ) : !payable ? (
            <p>
              {!view.shippingConfigured
                ? "هزینه ارسال هنوز تعیین نشده است؛ فعلاً واریز نکنید و با فروشگاه هماهنگ کنید."
                : "این سفارش در وضعیت قابل پرداخت نیست. برای بررسی با فروشگاه تماس بگیرید."}
            </p>
          ) : (
            <>
              {view.receipt?.status === "rejected" && (
                <p
                  role="status"
                  className="rounded-xl border border-crimson-500/30 p-3"
                >
                  رسید قبلی تأیید نشد. اگر واریز کرده‌اید، رسید درست را بفرستید
                  یا با فروشگاه تماس بگیرید؛ پیش از بررسی دوباره واریز نکنید.
                </p>
              )}
              <div
                className="rounded-2xl border border-gold-500/30 bg-gold-500/5 p-5"
                aria-label="کارت بانکی مقصد"
              >
                <p className="text-cream-400">
                  کارت مقصد · {view.config.bankName}
                </p>
                <p
                  dir="ltr"
                  className="my-4 select-all text-center font-mono text-xl tracking-wider sm:text-2xl"
                >
                  {view.config.cardNumber.replace(/(.{4})(?=.)/g, "$1 ")}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{view.config.accountName}</span>
                  <button
                    type="button"
                    className="flex min-h-11 items-center gap-2 text-accent"
                    onClick={async () => {
                      try {
                        if (view.config.enabled)
                          await navigator.clipboard.writeText(
                            view.config.cardNumber,
                          );
                        setNotice("شماره کارت کپی شد.");
                      } catch {
                        setError("شماره کارت را انتخاب و دستی کپی کنید.");
                      }
                    }}
                  >
                    <Copy size={16} />
                    کپی شماره کارت
                  </button>
                </div>
              </div>
              <p className="flex flex-wrap justify-between gap-2 rounded-xl bg-gold-500/5 p-4">
                <span>مبلغ دقیق واریز (تومان)</span>
                <strong className="text-accent">
                  {formatPrice(view.order.total)}
                </strong>
              </p>
              <p>
                پس از کارت‌به‌کارت از برنامه بانکی خود، عکس رسید را انتخاب کنید
                و «پرداخت کردم؛ ارسال رسید» را بزنید. تأیید پرداخت پس از بررسی
                فروشگاه انجام می‌شود.
              </p>
              <form onSubmit={upload} className="space-y-3">
                <label
                  htmlFor={`receipt-${orderId}`}
                  className="block font-bold"
                >
                  عکس رسید پرداخت
                </label>
                <input
                  id={`receipt-${orderId}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  aria-describedby={`receipt-help-${orderId}`}
                  className="block min-h-11 w-full min-w-0 rounded-xl border border-gold-500/30 p-3"
                  onChange={(e) => {
                    setError("");
                    const selected = e.target.files?.[0];
                    if (
                      selected &&
                      (!["image/jpeg", "image/png", "image/webp"].includes(
                        selected.type,
                      ) ||
                        selected.size > 4 * 1024 * 1024 ||
                        !selected.size)
                    ) {
                      setError(
                        "تصویر JPG، PNG یا WebP تا ۴ مگابایت انتخاب کنید.",
                      );
                      setFile(null);
                      e.target.value = "";
                    } else setFile(selected ?? null);
                  }}
                />
                <p
                  id={`receipt-help-${orderId}`}
                  className="text-xs text-cream-400"
                >
                  JPG، PNG یا WebP، حداکثر ۴ مگابایت. رسید در سایت عمومی نمایش
                  داده نمی‌شود و برای بررسی به حساب بلهٔ فروشگاه ارسال می‌شود.
                </p>
                {preview && (
                  <img
                    src={preview}
                    alt="پیش‌نمایش رسید انتخاب‌شده"
                    className="mx-auto max-h-72 max-w-full rounded-xl object-contain"
                  />
                )}
                <button
                  type="submit"
                  disabled={!file || busy}
                  className="btn-solid flex min-h-11 w-full items-center justify-center gap-2 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Upload size={18} />
                  )}{" "}
                  {busy ? "در حال ارسال رسید…" : "پرداخت کردم؛ ارسال رسید"}
                </button>
              </form>
            </>
          )}
        </>
      )}
    </section>
  );
}
