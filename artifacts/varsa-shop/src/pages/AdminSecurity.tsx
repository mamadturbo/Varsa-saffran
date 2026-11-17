import { useEffect, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { getApiErrorMessage } from "@/lib/orders-api";
export function AdminSecurity({ onEnded }: { onEnded: () => void }) {
  const [passwordOnly, setPasswordOnly] = useState(false);
  useEffect(() => {
    customFetch<{passwordOnly?: boolean}>('/api/admin/login-options')
      .then(result => setPasswordOnly(result.passwordOnly === true)).catch(() => {});
  }, []);
  const [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [recoveryCode, setRecovery] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(action: "password" | "mfa/disable") {
    setBusy(true);
    setError("");
    try {
      await customFetch("/api/admin/" + action, {
        method: "POST",
        body: JSON.stringify({ password, code, recoveryCode, newPassword }),
      });
      setPassword("");
      setCode("");
      setRecovery("");
      setNewPassword("");
      onEnded();
    } catch (e) {
      setError(getApiErrorMessage(e, "انجام عملیات ممکن نشد."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="adm-panel p-6 mt-6">
      <h2>امنیت حساب مدیر</h2>
      <p className="my-3">
        {passwordOnly ? 'ورود دومرحله‌ای فعلاً غیرفعال است. تغییر رمز به تأیید رمز فعلی نیاز دارد و همهٔ نشست‌ها را پایان می‌دهد.' : <>تغییر رمز و حذف عامل دوم به تأیید دوبارهٔ رمز و کد نیاز دارد و همهٔ
        نشست‌ها را پایان می‌دهد. پس از حذف عامل دوم، برای ورود به پنل باید آن را
        دوباره فعال کنید.</>}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit("password");
        }}
        className="grid gap-4 max-w-lg"
      >
        <label>
          رمز فعلی
          <input
            className="input-luxe"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={256}
          />
        </label>
        {!passwordOnly && <><label>
          کد برنامهٔ احراز هویت
          <input
            className="input-luxe"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            dir="ltr"
          />
        </label>
        <details>
          <summary>استفاده از کد بازیابی</summary>
          <label>
            کد بازیابی
            <input
              className="input-luxe"
              autoComplete="off"
              value={recoveryCode}
              onChange={(e) => setRecovery(e.target.value)}
              maxLength={32}
              dir="ltr"
            />
          </label>
        </details></>}
        <label>
          رمز جدید
          <input
            className="input-luxe"
            type="password"
            autoComplete="new-password"
            required
            minLength={14}
            maxLength={256}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="adm-button" disabled={busy}>
          {busy ? "در حال بررسی…" : "تغییر رمز و پایان همهٔ نشست‌ها"}
        </button>
        {!passwordOnly && <button
          className="adm-button adm-secondary"
          type="button"
          disabled={busy || !password || (!code && !recoveryCode)}
          onClick={() => void submit("mfa/disable")}
        >
          حذف عامل دوم و پایان همهٔ نشست‌ها
        </button>}
      </form>
    </section>
  );
}
