import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { formatPrice, toFaDigits } from "@/lib/site";
import { getApiErrorMessage } from "@/lib/orders-api";
import {
  changeFollowup,
  createFollowup,
  listCustomerContacts,
  readContactHistory,
  type ContactHistory,
  type CustomerContact,
  type Followup,
} from "@/lib/admin-customers-api";

const tehran = "Asia/Tehran";
const displayDate = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: tehran,
});
const fieldDate = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: tehran,
  hourCycle: "h23",
});
const zoneOffset = new Intl.DateTimeFormat("en", {
  timeZone: tehran,
  timeZoneName: "longOffset",
});
const formatDate = (value: string) => displayDate.format(new Date(value));
const formDate = (value: string) =>
  fieldDate.format(new Date(value)).replace(" ", "T");
const fail = (reason: unknown) =>
  getApiErrorMessage(reason, "عملیات انجام نشد. دوباره تلاش کنید.");
const orderLabels: Record<string, string> = {
  pending: "در انتظار بررسی",
  confirmed: "تأییدشده",
  processing: "در حال آماده‌سازی",
  shipped: "ارسال‌شده",
  delivered: "تحویل‌شده",
  cancelled: "لغوشده",
};
const paymentLabels = {
  paid: "تأییدشده",
  unpaid: "تأیید نشده",
  refunded: "مسترد شده",
};

function utcDue(local: string) {
  const guess = new Date(`${local}Z`);
  const offset = zoneOffset
    .formatToParts(guess)
    .find((part) => part.type === "timeZoneName")?.value;
  return new Date(`${local}${offset?.slice(3) || "Z"}`).toISOString();
}

function FollowupRow({
  item,
  busy,
  onUpdate,
}: {
  item: Followup;
  busy: boolean;
  onUpdate: (data: { dueAt: string } | { complete: true }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [due, setDue] = useState("");
  useEffect(() => setEditing(false), [item.dueAt, item.completedAt]);
  return (
    <article className="adm-contact-entry">
      <strong>{item.dueAt ? "پیگیری" : "یادداشت تماس"}</strong>
      <p className="adm-followup-text">{item.text}</p>
      <small>ثبت {formatDate(item.createdAt)}</small>
      {item.dueAt && <p>موعد {formatDate(item.dueAt)}</p>}
      {item.completedAt && <p>انجام‌شده در {formatDate(item.completedAt)}</p>}
      {item.dueAt && !item.completedAt && (
        <div className="adm-contact-actions">
          <button
            type="button"
            className="adm-button adm-secondary"
            disabled={busy}
            onClick={() => onUpdate({ complete: true })}
          >
            علامت‌زدن به‌عنوان انجام‌شده
          </button>
          {!editing && (
            <button
              type="button"
              className="adm-button adm-secondary"
              disabled={busy}
              onClick={() => {
                setDue(formDate(item.dueAt!));
                setEditing(true);
              }}
            >
              تغییر موعد
            </button>
          )}
        </div>
      )}
      {editing && (
        <form
          className="adm-contact-actions"
          onSubmit={(e) => {
            e.preventDefault();
            if (due) onUpdate({ dueAt: utcDue(due) });
          }}
        >
          <label className="adm-field">
            موعد جدید به وقت تهران
            <input
              type="datetime-local"
              dir="ltr"
              value={due}
              required
              disabled={busy}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <button className="adm-button" disabled={busy}>
            ذخیره موعد
          </button>
          <button
            type="button"
            className="adm-button adm-secondary"
            disabled={busy}
            onClick={() => setEditing(false)}
          >
            انصراف
          </button>
        </form>
      )}
    </article>
  );
}

function ContactDetail({
  contact,
  revision,
  onBack,
  onChanged,
  onOrder,
}: {
  contact: CustomerContact;
  revision: number;
  onBack: () => void;
  onChanged: () => void;
  onOrder: (id: string) => Promise<void>;
}) {
  const [history, setHistory] = useState<ContactHistory | null>(null);
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    readContactHistory(contact.id)
      .then((result) => {
        if (active) setHistory(result);
      })
      .catch((reason) => {
        if (active) setError(fail(reason));
      });
    return () => {
      active = false;
    };
  }, [contact.id, revision, attempt]);

  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(fail(e));
    } finally {
      setBusy(false);
    }
  }
  function update(
    item: Followup,
    data: { dueAt: string } | { complete: true },
  ) {
    void perform(async () => {
      const { followup } = await changeFollowup(contact.id, item.id, data);
      setHistory(
        (previous) =>
          previous && {
            ...previous,
            followups: previous.followups.map((row) =>
              row.id === followup.id ? followup : row,
            ),
          },
      );
      onChanged();
    });
  }

  return (
    <section className="adm-panel adm-contacts" aria-label="پرونده مشتری">
      <div className="adm-panel-heading">
        <div>
          <h2>{contact.name}</h2>
          <bdi>{contact.phone}</bdi>
        </div>
        <button
          type="button"
          className="adm-button adm-secondary"
          onClick={onBack}
        >
          بازگشت به مشتری‌ها
        </button>
      </div>
      <p>
        پرداخت تأییدشده{" "}
        {new Intl.NumberFormat("fa-IR").format(BigInt(contact.paidTotal))} تومان
      </p>
      {error && (
        <div className="adm-error" role="alert">
          {error}
          {!history && (
            <button
              type="button"
              className="adm-button adm-secondary"
              onClick={() => {
                setError("");
                setAttempt((n) => n + 1);
              }}
            >
              تلاش مجدد
            </button>
          )}
        </div>
      )}
      {!history && !error && <p role="status">در حال دریافت پرونده…</p>}
      {history && (
        <div className="adm-contact-grid">
          <section>
            <h3>سابقهٔ سفارش</h3>
            {history.orders.map((order) => (
              <article
                className="adm-contact-entry adm-contact-order"
                key={order.id}
              >
                <div>
                  <strong dir="ltr">{order.orderNumber}</strong>
                  <p>
                    {orderLabels[order.status] ?? order.status} ·{" "}
                    {formatDate(order.createdAt)}
                  </p>
                  <p>
                    {formatPrice(order.total)} · پرداخت{" "}
                    {paymentLabels[order.paymentStatus ?? "unpaid"]}
                  </p>
                </div>
                <button
                  type="button"
                  className="adm-button adm-secondary"
                  disabled={busy}
                  aria-label={`جزئیات سفارش ${order.orderNumber}`}
                  onClick={() => void perform(() => onOrder(String(order.id)))}
                >
                  جزئیات
                </button>
              </article>
            ))}
            {history.nextCursor !== null && (
              <button
                type="button"
                className="adm-button adm-secondary"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    const page = await readContactHistory(
                      contact.id,
                      history.nextCursor!,
                    );
                    setHistory(
                      (previous) =>
                        previous && {
                          ...previous,
                          orders: [...previous.orders, ...page.orders],
                          nextCursor: page.nextCursor,
                        },
                    );
                  })
                }
              >
                سفارش‌های قدیمی‌تر
              </button>
            )}
          </section>
          <section>
            <h3>یادداشت و پیگیری</h3>
            <form
              className="adm-contact-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (busy || !note.trim()) return;
                void perform(async () => {
                  const { followup } = await createFollowup(
                    contact.id,
                    note,
                    due ? utcDue(due) : null,
                  );
                  setHistory(
                    (previous) =>
                      previous && {
                        ...previous,
                        followups: [followup, ...previous.followups],
                      },
                  );
                  setNote("");
                  setDue("");
                  onChanged();
                });
              }}
            >
              <label className="adm-field">
                متن یادداشت یا پیگیری
                <textarea
                  rows={3}
                  value={note}
                  maxLength={2000}
                  required
                  disabled={busy}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <label className="adm-field">
                موعد پیگیری به وقت تهران (اختیاری)
                <input
                  type="datetime-local"
                  dir="ltr"
                  value={due}
                  disabled={busy}
                  onChange={(e) => setDue(e.target.value)}
                />
              </label>
              <button className="adm-button" disabled={busy || !note.trim()}>
                {due ? "ثبت پیگیری" : "ثبت یادداشت"}
              </button>
            </form>
            {history.followups.length ? (
              history.followups.map((item) => (
                <FollowupRow
                  key={item.id}
                  item={item}
                  busy={busy}
                  onUpdate={(data) => update(item, data)}
                />
              ))
            ) : (
              <p>هنوز یادداشت یا موعدی ثبت نشده است.</p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

export function AdminCustomers({
  revision,
  onOrder,
}: {
  revision: number;
  onOrder: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [due, setDue] = useState(false);
  const [cursors, setCursors] = useState<string[]>([]);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof listCustomerContacts>
  > | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<CustomerContact | null>(null);
  const [changed, setChanged] = useState(0);
  const cursor = cursors.at(-1);
  useEffect(() => {
    if (selected) return;
    let active = true;
    setResult(null);
    setError("");
    listCustomerContacts(query, due, cursor)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((reason) => {
        if (active) setError(fail(reason));
      });
    return () => {
      active = false;
    };
  }, [query, due, cursor, revision, changed, selected]);

  if (selected)
    return (
      <ContactDetail
        key={selected.id}
        contact={selected}
        revision={revision}
        onBack={() => setSelected(null)}
        onChanged={() => setChanged((n) => n + 1)}
        onOrder={onOrder}
      />
    );
  return (
    <section className="adm-panel adm-contacts" aria-label="مشتری‌ها">
      <form
        className="adm-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(draft.trim());
          setCursors([]);
        }}
      >
        <label className="adm-search">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="نام یا موبایل مشتری"
            placeholder="نام یا موبایل مشتری"
            value={draft}
            maxLength={120}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <button className="adm-button">جست‌وجو</button>
        <label className="adm-contact-due">
          <input
            type="checkbox"
            checked={due}
            onChange={(e) => {
              setDue(e.target.checked);
              setCursors([]);
            }}
          />
          پیگیری‌های سررسیدشده
        </label>
      </form>
      {error ? (
        <div className="adm-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="adm-button adm-secondary"
            onClick={() => setChanged((n) => n + 1)}
          >
            تلاش مجدد
          </button>
        </div>
      ) : !result ? (
        <p role="status">در حال دریافت مشتری‌ها…</p>
      ) : result.contacts.length ? (
        <ul className="adm-contact-list">
          {result.contacts.map((contact) => (
            <li key={contact.id}>
              <button
                type="button"
                className="adm-contact-card"
                onClick={() => setSelected(contact)}
              >
                <span>
                  <strong>{contact.name}</strong>
                  <bdi>{contact.phone}</bdi>
                </span>
                <span>
                  <small>{toFaDigits(contact.orderCount)} سفارش</small>
                  <small>آخرین خرید {formatDate(contact.lastOrderAt)}</small>
                </span>
                {contact.nextDueAt && (
                  <span className="adm-contact-next">
                    {Date.parse(contact.nextDueAt) <= Date.now()
                      ? "پیگیری سررسیدشده"
                      : "پیگیری بعدی"}
                    <small>{formatDate(contact.nextDueAt)}</small>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>{due ? "پیگیری سررسیدشده‌ای پیدا نشد." : "مشتری‌ای پیدا نشد."}</p>
      )}
      {(cursors.length > 0 || result?.nextCursor) && (
        <div className="adm-contact-actions">
          <button
            type="button"
            className="adm-button adm-secondary"
            disabled={!cursors.length || !result}
            onClick={() => setCursors((previous) => previous.slice(0, -1))}
          >
            صفحه قبل
          </button>
          <button
            type="button"
            className="adm-button adm-secondary"
            disabled={!result?.nextCursor}
            onClick={() =>
              setCursors((previous) => [...previous, result!.nextCursor!])
            }
          >
            صفحه بعد
          </button>
        </div>
      )}
    </section>
  );
}
