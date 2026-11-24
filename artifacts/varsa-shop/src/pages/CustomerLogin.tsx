import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Loader2,
} from "lucide-react";
import type { Customer } from "@workspace/catalog";
import { normalizeIranMobile } from "@workspace/validation";
import { useCustomer } from "@/lib/customer";
import { customerRequest } from "@/lib/customer-api";
import { toFaDigits } from "@/lib/site";
import { getApiErrorMessage } from "@/lib/orders-api";
export function CustomerLogin({
  tracking,
  checkout = false,
}: {
  checkout?: boolean;
  tracking?: {
    orderNumber: string;
    onOrderNumberChange: (value: string) => void;
    claim: (value: string) => Promise<void>;
  };
}) {
  const { acceptCustomer } = useCustomer();
  const [phone, setPhone] = useState(""),
    [verifiedPhone, setVerifiedPhone] = useState(""),
    [code, setCode] = useState(""),
    [development, setDevelopment] = useState(""),
    [step, setStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [retryAt, setRetryAt] = useState(0),
    [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const update = () =>
      setSeconds(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  const request = async () => {
    const p = normalizeIranMobile(phone);
    if (!p) {
      setError("شماره موبایل معتبر ایران وارد کنید.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await customerRequest<{
        phone: string;
        developmentCode?: string;
        retryAfter: number;
      }>("/customer/auth/request", "POST", { phone: p });
      setVerifiedPhone(r.phone);
      setPhone(r.phone);
      setDevelopment(r.developmentCode ?? "");
      setRetryAt(Date.now() + r.retryAfter * 1000);
      setStep("code");
      setCode("");
    } catch (e) {
      setError(getApiErrorMessage(e, "ارسال کد انجام نشد."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto w-full max-w-md">
      {!checkout && (
        <h1 className="mb-6 text-center font-display text-2xl font-bold text-cream-50 sm:text-3xl">
          {tracking ? "پیگیری سفارش" : "ثبت‌نام یا ورود"}
        </h1>
      )}
      <div className="vc-login rounded-2xl border border-gold-500/25 bg-surface-tint-soft p-5 sm:p-7">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 grid size-12 place-items-center rounded-full border border-gold-500/30 bg-gold-500/10 text-accent"
        >
          {step === "phone" ? (
            <Smartphone size={22} />
          ) : (
            <ShieldCheck size={22} />
          )}
        </div>
        {step === "code" && (
          <h2 className="mb-2 text-center text-base font-bold text-cream-50">
            تأیید شماره موبایل
          </h2>
        )}
        <p className="mb-5 text-start text-sm leading-7 text-cream-300">
          {step === "phone"
            ? tracking
              ? "شمارهٔ سفارش و موبایلی را که هنگام خرید ثبت کردید وارد کنید."
              : checkout
                ? "برای ادامهٔ خرید، شماره موبایل خود را تأیید کنید."
                : "با شماره موبایل، وارد حساب ورسا شوید یا حساب بسازید."
            : `کد شش‌رقمی ارسال‌شده به ${toFaDigits(verifiedPhone)} را وارد کنید.`}
        </p>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            if (step === "phone") {
              await request();
              return;
            }
            setBusy(true);
            setError("");
            try {
              const r = await customerRequest<{ customer: Customer }>(
                "/customer/auth/verify",
                "POST",
                { phone: verifiedPhone, code },
              );
              if (tracking) await tracking.claim(tracking.orderNumber);
              await acceptCustomer(r.customer);
            } catch (err) {
              setError(getApiErrorMessage(err, "ورود انجام نشد."));
            } finally {
              setBusy(false);
            }
          }}
        >
          {tracking && step === "phone" && (
            <label className="block">
              <span className="label-luxe">شمارهٔ سفارش</span>
              <input
                className="input-luxe min-h-11 text-end"
                dir="ltr"
                autoComplete="off"
                placeholder="VRS-…"
                maxLength={32}
                required
                value={tracking.orderNumber}
                disabled={busy}
                onChange={(e) => tracking.onOrderNumberChange(e.target.value)}
              />
            </label>
          )}
          <label className="block">
            <span className="label-luxe">
              {step === "phone" ? "شماره موبایل" : "کد شش‌رقمی"}
            </span>
            <input
              className="input-luxe min-h-11 text-end"
              key={step}
              autoFocus={step === "code"}
              dir="ltr"
              inputMode={step === "phone" ? "tel" : "numeric"}
              type={step === "phone" ? "tel" : "text"}
              autoComplete={step === "phone" ? "tel" : "one-time-code"}
              maxLength={step === "phone" ? 64 : 6}
              required
              value={step === "phone" ? phone : code}
              disabled={busy}
              onChange={(e) =>
                step === "phone"
                  ? setPhone(e.target.value)
                  : setCode(e.target.value)
              }
              placeholder={step === "phone" ? "۰۹۱۲۳۴۵۶۷۸۹" : "— — — — — —"}
            />
          </label>
          {development && step === "code" && (
            <p className="rounded-xl border border-gold-500/30 bg-gold-500/10 p-3 text-sm leading-6 text-accent">
              پیش‌نمایش محلی؛ پیامک واقعی ارسال نشده است.
              <br />
              کد آزمایشی: <strong dir="ltr">{development}</strong>
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-crimson-500/30 bg-crimson-500/10 p-3 text-sm leading-6 text-crimson-700 dark:text-crimson-200"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn-solid min-h-11 w-full disabled:opacity-50"
            disabled={busy}
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : null}
            {step === "phone" ? "دریافت کد ورود" : "تأیید و ورود"}
            <ArrowLeft aria-hidden="true" size={17} />
          </button>
        </form>
        {step === "code" && (
          <div className="mt-3 flex flex-wrap justify-between gap-2">
            <button
              type="button"
              className="btn-ghost min-h-11 !px-3 !py-2 text-xs disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                setStep("phone");
                setError("");
              }}
            >
              ویرایش شماره
              <ArrowRight aria-hidden="true" size={15} />
            </button>
            <button
              type="button"
              className="btn-ghost min-h-11 !px-3 !py-2 text-xs disabled:opacity-50"
              disabled={busy || seconds > 0}
              onClick={() => void request()}
            >
              {seconds > 0
                ? `ارسال مجدد در ${toFaDigits(seconds)} ثانیه`
                : "ارسال دوباره کد"}
            </button>
          </div>
        )}
        {step === "code" && (
          <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-cream-400">
            <ShieldCheck
              aria-hidden="true"
              size={15}
              className="mt-1 shrink-0"
            />
            کد ورود تا ۲ دقیقه معتبر است. آن را در اختیار دیگران نگذارید.
          </p>
        )}
      </div>
      <div className="mt-4 text-center">
        <Link href="/shop" className="btn-ghost min-h-11">
          بازگشت به فروشگاه
          <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </div>
    </div>
  );
}
