import { VarsaMark } from '@/components/Brand';
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
export function CustomerLogin() {
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
    <div className="vc-login">
      <div className="vc-login-story">
        <VarsaMark tone="gold" aria-hidden="true" className="vc-seal" />
        <h1>
          خوش آمدید
          <br />
          به خانه‌ی ورسا
        </h1>
        <p>
          خریدهای شما، عطرهای محبوب شما،
          <br />و هر آنچه برای همراهی با ورسا نیاز دارید.
        </p>
        <Link href="/shop">
          بازگشت به فروشگاه
          <ArrowLeft size={18} />
        </Link>
      </div>
      <div className="vc-login-form">
        <div className="vc-login-icon">
          {step === "phone" ? (
            <Smartphone size={28} />
          ) : (
            <ShieldCheck size={28} />
          )}
        </div>
        <h2>{step === "phone" ? "ورود یا ساخت حساب" : "تأیید شماره موبایل"}</h2>
        <p>
          {step === "phone"
            ? "با شماره موبایل خود وارد شوید؛ ساخت حساب به رمز عبور نیاز ندارد."
            : `کد شش‌رقمی ارسال‌شده به ${toFaDigits(verifiedPhone)} را وارد کنید.`}
        </p>
        <form
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
              await acceptCustomer(r.customer);
            } catch (err) {
              setError(getApiErrorMessage(err, "ورود انجام نشد."));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="vc-field">
            <span>{step === "phone" ? "شماره موبایل" : "کد شش‌رقمی"}</span>
            <input
              key={step}
              autoFocus
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
            <p className="vc-development">
              پیش‌نمایش محلی؛ پیامک واقعی ارسال نشده است.
              <br />
              کد آزمایشی: <strong dir="ltr">{development}</strong>
            </p>
          )}
          {error && (
            <p role="alert" className="vc-error">
              {error}
            </p>
          )}
          <button className="vc-button" disabled={busy}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : null}
            {step === "phone" ? "دریافت کد ورود" : "تأیید و ورود"}
            <ArrowLeft size={17} />
          </button>
        </form>
        {step === "code" && (
          <div className="vc-login-options">
            <button
              disabled={busy}
              onClick={() => {
                setStep("phone");
                setError("");
              }}
            >
              ویرایش شماره
              <ArrowRight size={15} />
            </button>
            <button
              disabled={busy || seconds > 0}
              onClick={() => void request()}
            >
              {seconds > 0
                ? `ارسال مجدد در ${toFaDigits(seconds)} ثانیه`
                : "ارسال دوباره کد"}
            </button>
          </div>
        )}
        <p className="vc-hint">
          <ShieldCheck size={15} />
          کد ورود شما ۲ دقیقه اعتبار دارد؛ آن را در اختیار دیگران نگذارید.
        </p>
      </div>
    </div>
  );
}
