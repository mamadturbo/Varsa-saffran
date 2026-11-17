import { useCallback, useEffect, useState } from "react";
import {
  MessageCircle,
  Star,
  Users,
  Bell,
  RefreshCw,
  ChevronLeft,
  X,
} from "lucide-react";
import {
  getCustomerService,
  customerRequest,
  type CustomerServiceData,
} from "@/lib/customer-api";
import { readOrders, type AdminOrder } from "@/lib/management-api";
import { getApiErrorMessage } from "@/lib/orders-api";
import { toFaDigits } from "@/lib/site";
import { StoreDialog, StoreDialogTitle } from "@/components/StoreDialog";
import { CaseConversation, CustomerEmpty } from "./CustomerAccount";
import "./customer.css";
const labels: Record<string, string> = {
  waiting_admin: "منتظر پاسخ فروشگاه",
  waiting_customer: "منتظر پاسخ مشتری",
  closed: "بسته‌شده",
  approved: "پذیرفته‌شده",
  rejected: "ردشده",
  ticket: "تیکت پشتیبانی",
  cancel: "درخواست لغو",
  return: "درخواست مرجوعی",
  pending: "در صف ارسال",
  sending: "در حال ارسال",
  failed: "ارسال ناموفق",
};
export function AdminCustomerService({
  onUnauthorized,
}: {
  onUnauthorized?: () => void;
}) {
  const [data, setData] = useState<CustomerServiceData | null>(null),
    [orders, setOrders] = useState<AdminOrder[]>([]),
    [tab, setTab] = useState("cases"),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [r, o] = await Promise.all([getCustomerService(), readOrders()]);
      setData(r);
      setOrders(o);
    } catch (e) {
      if ((e as { status?: number }).status === 401) onUnauthorized?.();
      setError(getApiErrorMessage(e, "دریافت اطلاعات خدمات مشتری انجام نشد."));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const action = async (path: string, body: unknown, method = "POST") => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await customerRequest(path, method, body);
      await load();
      setNotice("تغییرات ذخیره شد.");
    } catch (e) {
      setError(getApiErrorMessage(e, "ذخیره انجام نشد."));
    } finally {
      setBusy(false);
    }
  };
  const chosen = data?.cases.find((c) => c.id === selected);
  const customer = (id: string) => data?.customers.find((c) => c.id === id);
  const orderNumber = (id: number | null) =>
    orders.find((o) => o.id === String(id))?.orderNumber;
  const match = (value: string) =>
    value
      .toLocaleLowerCase("fa")
      .includes(query.trim().toLocaleLowerCase("fa"));
  return (
    <div className="varsa-customer" style={{ background: "transparent" }}>
      <div
        className="adm-toolbar"
        style={{ padding: "0 0 22px", border: 0, flexWrap: "wrap" }}
      >
        {[
          ["cases", "تیکت‌ها و درخواست‌ها", MessageCircle],
          ["reviews", "بررسی نظرها", Star],
          ["accounts", "حساب‌های مشتری", Users],
          ["sms", "وضعیت پیامک", Bell],
        ].map(([key, label, Icon]) => {
          const I = Icon as typeof Star;
          return (
            <button
              key={key as string}
              className={`adm-button ${tab === key ? "" : "adm-secondary"}`}
              aria-pressed={tab === key}
              onClick={() => {
                setTab(key as string);
                setQuery("");
                setFilter("all");
              }}
            >
              <I size={17} />
              {label as string}
            </button>
          );
        })}
        <button
          className="adm-icon"
          disabled={busy}
          aria-label="به‌روزرسانی خدمات مشتری"
          onClick={() => void load()}
        >
          <RefreshCw size={18} className={busy ? "animate-spin" : ""} />
        </button>
      </div>
      {error && (
        <p className="vc-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="vc-success" role="status">
          {notice}
        </p>
      )}
      {!data ? (
        <div className="adm-panel">
          <CustomerEmpty
            title={busy ? "در حال دریافت اطلاعات…" : "اطلاعات در دسترس نیست"}
          />
        </div>
      ) : (
        <section className="adm-panel">
          <div className="adm-toolbar">
            <label className="adm-search">
              <span className="sr-only">جست‌وجوی خدمات مشتری</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جست‌وجوی نام، موبایل یا موضوع…"
              />
            </label>
            {tab === "cases" && (
              <select
                aria-label="نوع درخواست"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">همه درخواست‌ها</option>
                <option value="waiting_admin">منتظر پاسخ فروشگاه</option>
                <option value="ticket">تیکت‌ها</option>
                <option value="cancel">لغو سفارش</option>
                <option value="return">مرجوعی</option>
              </select>
            )}
          </div>
          {tab === "cases" &&
            (data.cases.length ? (
              <div className="vc-case-list">
                {data.cases
                  .filter(
                    (c) =>
                      (filter === "all" ||
                        c.status === filter ||
                        c.kind === filter) &&
                      match(
                        `${c.payload.subject} ${customer(c.customerId)?.phone ?? ""} ${customer(c.customerId)?.profile.name ?? ""} ${orderNumber(c.orderId) ?? ""}`,
                      ),
                  )
                  .map((c) => (
                    <button key={c.id} onClick={() => setSelected(c.id)}>
                      <MessageCircle size={22} />
                      <div>
                        <strong>{c.payload.subject}</strong>
                        <small>
                          {labels[c.kind]} ·{" "}
                          {customer(c.customerId)?.profile.name || "مشتری ورسا"}{" "}
                          · {toFaDigits(customer(c.customerId)?.phone ?? "")}
                          {orderNumber(c.orderId) &&
                            ` · ${orderNumber(c.orderId)}`}
                        </small>
                      </div>
                      <span className={`vc-status vc-status-${c.status}`}>
                        {labels[c.status]}
                      </span>
                      <ChevronLeft size={17} />
                    </button>
                  ))}
              </div>
            ) : (
              <CustomerEmpty title="هنوز درخواستی از مشتری‌ها ثبت نشده است" />
            ))}
          {tab === "reviews" &&
            (data.reviews.length ? (
              <div className="vc-reviewable">
                {data.reviews
                  .filter((r) => match(`${r.author} ${r.body}`))
                  .map((r) => (
                    <article key={r.id}>
                      <Star size={25} />
                      <div>
                        <h3>
                          {r.author} · {toFaDigits(r.rating)} از ۵
                        </h3>
                        <p>
                          {orders
                            .flatMap((o) => o.items)
                            .find((i) => i.productId === r.productId)?.name ??
                            "محصول خریداری‌شده"}
                        </p>
                        <p style={{ whiteSpace: "pre-wrap" }}>{r.body}</p>
                        <span className="vc-status">
                          {r.published ? "منتشرشده" : "منتظر تأیید"}
                        </span>
                      </div>
                      <button
                        className="vc-button vc-secondary"
                        disabled={busy}
                        onClick={() =>
                          void action(
                            `/admin/customer-service/reviews/${r.id}`,
                            { published: !r.published },
                            "PATCH",
                          )
                        }
                      >
                        {r.published ? "توقف انتشار" : "تأیید و انتشار"}
                      </button>
                    </article>
                  ))}
              </div>
            ) : (
              <CustomerEmpty title="نظری برای بررسی وجود ندارد" />
            ))}
          {tab === "accounts" &&
            (data.customers.length ? (
              <div className="adm-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>نام مشتری</th>
                      <th>موبایل تأییدشده</th>
                      <th>ایمیل</th>
                      <th>آدرس‌ها</th>
                      <th>پیامک وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customers
                      .filter((c) =>
                        match(
                          `${c.profile.name} ${c.phone} ${c.profile.email}`,
                        ),
                      )
                      .map((c) => (
                        <tr key={c.id}>
                          <td>{c.profile.name || "تکمیل نشده"}</td>
                          <td dir="ltr" data-label="موبایل">
                            {c.phone}
                          </td>
                          <td dir="ltr" data-label="ایمیل">
                            {c.profile.email || "—"}
                          </td>
                          <td data-label="آدرس‌ها">
                            {toFaDigits(c.profile.addresses.length)}
                          </td>
                          <td data-label="پیامک وضعیت">
                            {c.profile.smsUpdates
                              ? "مایل به دریافت"
                              : "غیرفعال"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <CustomerEmpty title="هنوز حساب مشتری ساخته نشده است" />
            ))}
          {tab === "sms" && (
            <div className="vc-form">
              <h2>پیامک‌های وضعیت</h2>
              <p className="vc-hint">
                ارسال پس از تنظیم سرویس پیامک روی میزبان و فعال‌سازی در تنظیمات
                فروشگاه انجام می‌شود؛ فقط برای مشتریانی که دریافت پیامک را
                انتخاب کرده‌اند.
              </p>
              <button
                className="vc-button vc-secondary"
                disabled={busy}
                onClick={() =>
                  void action("/admin/customer-service/retry-sms", {})
                }
              >
                تلاش مجدد پیامک‌های ناموفق
                <RefreshCw size={16} />
              </button>
              {data.notifications.length ? (
                data.notifications.map((n) => (
                  <div className="vc-case-heading" key={n.id}>
                    <div>
                      <strong>{n.title}</strong>
                      <small>
                        {toFaDigits(customer(n.customerId)?.phone ?? "")}
                      </small>
                    </div>
                    <span className="vc-status">
                      {labels[n.smsStatus] ?? n.smsStatus}
                    </span>
                  </div>
                ))
              ) : (
                <CustomerEmpty title="پیامک معطل یا ناموفق ندارید" />
              )}
            </div>
          )}
        </section>
      )}
      {chosen && (
        <StoreDialog
          id="admin-customer-case"
          open
          layer={90}
          onClose={() => setSelected(null)}
          className="varsa-customer vc-sheet"
        >
          <header>
            <div>
              <StoreDialogTitle asChild>
                <h2>بررسی و پاسخ به مشتری</h2>
              </StoreDialogTitle>
              <p className="vc-hint">
                {customer(chosen.customerId)?.profile.name || "مشتری ورسا"} ·{" "}
                {toFaDigits(customer(chosen.customerId)?.phone ?? "")}
                {orderNumber(chosen.orderId) &&
                  ` · ${orderNumber(chosen.orderId)}`}
              </p>
            </div>
            <button
              className="vc-icon"
              aria-label="بستن"
              onClick={() => setSelected(null)}
            >
              <X size={20} />
            </button>
          </header>
          <CaseConversation key={chosen.id} item={chosen} admin onDone={load} />
        </StoreDialog>
      )}
    </div>
  );
}
