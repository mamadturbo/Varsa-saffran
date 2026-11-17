import { VarsaLogo } from '@/components/Brand';
import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import {
  getApiErrorMessage,
  getAdminLoginRetryAfter,
  signInAdmin,
} from "@/lib/orders-api";
import { toFaDigits } from "@/lib/site";
import { customFetch } from "@workspace/api-client-react";
export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(
    null,
  );
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [temporaryEnabled, setTemporaryEnabled] = useState(false);
  const [passwordOnly, setPasswordOnly] = useState(false);
  const [temporaryCode, setTemporaryCode] = useState("");
  const inFlight = useRef(false);
  const [retryUntil, setRetryUntil] = useState(0);
  const [retrySeconds, setRetrySeconds] = useState(0);

  useEffect(() => {
    customFetch<{ temporaryCodeEnabled: boolean; passwordOnly?: boolean }>("/api/admin/login-options")
      .then((result) => {
        setTemporaryEnabled(result.temporaryCodeEnabled);
        setPasswordOnly(result.passwordOnly === true);
      })
      .catch(() => setTemporaryEnabled(false));
  }, []);

  const requestTemporaryCode = async () => {
    if (inFlight.current || retryUntil > Date.now()) return;
    if (!username.trim() || !password) {
      setError("ابتدا نام کاربری و رمز مدیر را وارد کنید.");
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setError("");
    setTemporaryCode("");
    try {
      const result = await customFetch<{ code: string }>(
        "/api/admin/temporary-code",
        {
          method: "POST",
          body: JSON.stringify({ username, password }),
        },
      );
      setCode(result.code);
      setRecoveryCode("");
      setTemporaryCode(result.code);
      setSetup(null);
    } catch (error) {
      setError(getApiErrorMessage(error, "دریافت کد موقت انجام نشد."));
      const retry = getAdminLoginRetryAfter(error);
      if (retry !== null) setRetryUntil(Date.now() + retry * 1000);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!retryUntil) return;
    const update = () =>
      setRetrySeconds(Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [retryUntil]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current || retryUntil > Date.now()) return;
    inFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      if (setup) {
        const result = await customFetch<{ recoveryCodes: string[] }>(
          "/api/admin/mfa/confirm",
          { method: "POST", body: JSON.stringify({ password, newCode: code }) },
        );
        setRecoveryCodes(result.recoveryCodes);
        setPassword("");
        setCode("");
        setSetup(null);
      } else {
        const result = await signInAdmin(
          password,
          username,
          code,
          recoveryCode,
        );
        if (result.enrollmentRequired) {
          setSetup(
            await customFetch<{ secret: string; uri: string }>(
              "/api/admin/mfa/begin",
              { method: "POST", body: JSON.stringify({ password }) },
            ),
          );
          setCode("");
        } else {
          setPassword("");
          setCode("");
          setRecoveryCode("");
          onSuccess();
        }
      }
    } catch (loginError) {
      setError(getApiErrorMessage(loginError, "رمز مدیر نادرست است."));
      const retry = getAdminLoginRetryAfter(loginError);
      if (retry !== null) {
        setRetrySeconds(retry);
        setRetryUntil(Date.now() + retry * 1000);
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-gold-500/25 bg-gold-500/10 text-accent">
            <ShieldCheck className="h-8 w-8" strokeWidth={1.4} />
          </div>
          <VarsaLogo className="mx-auto h-24 w-40" />
          <h1 className="mt-3 font-display text-3xl font-bold text-cream-50">
            مدیریت فروشگاه ورسا
          </h1>
          <p className="mt-3 text-sm leading-7 text-cream-400">
            سفارش‌ها، محصولات و محتوای فروشگاه، در یک جا.
          </p>
        </div>

        {recoveryCodes.length > 0 ? (
          <section className="card-luxe p-7" aria-label="کدهای بازیابی">
            <h2>کدهای بازیابی یک‌بارمصرف</h2>
            <p className="my-3">
              این کدها فقط همین بار نمایش داده می‌شوند. آن‌ها را در محل امن و
              جدا از دستگاه احراز هویت نگه دارید.
            </p>
            <pre dir="ltr" className="overflow-auto text-sm">
              {recoveryCodes.join("\n")}
            </pre>
            <button
              className="btn-solid mt-6 w-full"
              onClick={() => {
                setRecoveryCodes([]);
                onSuccess();
              }}
            >
              کدها را ذخیره کردم؛ ادامه
            </button>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="card-luxe p-7">
            {setup && (
              <div className="mb-5">
                <h2>فعال‌سازی ورود دومرحله‌ای</h2>
                <p>
                  کلید زیر را در برنامهٔ احراز هویت وارد کنید، سپس کد شش‌رقمی را
                  تأیید کنید. اعتبار این مرحله پنج دقیقه است.
                </p>
                <code dir="ltr" className="block break-all my-3 select-all">
                  {setup.secret}
                </code>
              </div>
            )}
            <label htmlFor="admin-username" className="mb-2 block text-sm">
              نام کاربری
            </label>
            <input
              id="admin-username"
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              maxLength={64}
              disabled={!!setup || submitting}
              className="input-luxe mb-4"
              dir="ltr"
            />
            {!passwordOnly && <><label htmlFor="admin-code" className="mt-4 mb-2 block text-sm">
              {setup
                ? "کد تأیید فعال‌سازی"
                : temporaryEnabled
                  ? "کد موقت یا کد برنامهٔ احراز هویت"
                  : "کد برنامهٔ احراز هویت"}
            </label>
            <input
              id="admin-code"
              className="input-luxe"
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value.replace(/[۰-۹]/g, (d) =>
                    String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
                  ),
                )
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              required={!!setup}
              disabled={submitting}
              dir="ltr"
            />
            {!setup && (
              <details className="mt-4">
                <summary>استفاده از کد بازیابی</summary>
                <label htmlFor="admin-recovery">کد بازیابی یک‌بارمصرف</label>
                <input
                  id="admin-recovery"
                  className="input-luxe mt-2"
                  dir="ltr"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  maxLength={32}
                  autoComplete="off"
                />
              </details>
            )}
            </>}
            <label
              htmlFor="admin-password"
              className="mb-2 block text-sm font-medium text-accent"
            >
              رمز ورود مدیر
            </label>
            <input
              id="admin-password"
              type="password"
              required
              maxLength={256}
              disabled={submitting || retrySeconds > 0}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-luxe"
              placeholder="رمز مدیر را وارد کنید"
            />
            {error && (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-crimson-500/25 bg-crimson-500/10 px-4 py-3 text-sm leading-6 text-crimson-700 dark:text-crimson-300"
              >
                {error}
              </p>
            )}
            {temporaryEnabled && (
              <div className="mt-4">
                <button
                  type="button"
                  className="btn-ghost w-full"
                  disabled={submitting || retrySeconds > 0}
                  onClick={requestTemporaryCode}
                >
                  دریافت کد موقت ورود
                </button>
                <p
                  className="mt-2 text-sm leading-7 text-cream-400"
                  role="status"
                >
                  {temporaryCode ? (
                    <>
                      کد موقت:{" "}
                      <strong dir="ltr" className="select-all">
                        {temporaryCode}
                      </strong>
                      ؛ تا پنج دقیقه و فقط برای یک ورود معتبر است. کد در فرم
                      وارد شد؛ «ورود به پنل» را بزنید.
                    </>
                  ) : (
                    "ورود موقت محلی: نام کاربری و رمز مدیر را وارد کنید و کد بگیرید."
                  )}
                </p>
              </div>
            )}
            <button
              type="submit"
              disabled={submitting || retrySeconds > 0}
              className="btn-solid mt-6 w-full disabled:cursor-wait disabled:opacity-60"
            >
              {submitting
                ? "در حال بررسی..."
                : retrySeconds > 0
                  ? `تلاش مجدد در ${toFaDigits(retrySeconds)} ثانیه`
                  : "ورود به پنل"}
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link href="/" className="btn-ghost mt-3 w-full">
              بازگشت به فروشگاه
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
