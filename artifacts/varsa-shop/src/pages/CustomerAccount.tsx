import { VarsaLogo } from '@/components/Brand';
import { DeliveryImage } from '@/components/DeliveryImage';
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  Menu,
  ShoppingBag,
  Heart,
  MapPin,
  MessageCircle,
  UserRound,
  Bell,
  LayoutDashboard,
  LogOut,
  ChevronLeft,
  ArrowLeft,
  Plus,
  Package,
  Check,
  X,
  RefreshCw,
  Star,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import type {
  CustomerAddress,
  CustomerCase,
  ProductReview,
} from "@workspace/catalog";
import { OrderTrackingHistory } from "@/components/OrderTrackingHistory";
import { useCustomer } from "@/lib/customer";
import {
  customerRequest,
  getDashboard,
  putAddress,
  type CustomerDashboard,
  type CustomerOrder,
} from "@/lib/customer-api";
import { useCart } from "@/lib/cart";
import { CHECKOUT_PATHS } from "@/lib/routes";
import { MAX_ORDER_LINES, MAX_PRODUCT_QUANTITY } from "@workspace/validation";
import { fetchProducts } from "@/lib/api";
import type { Product } from "@/lib/types";
import { formatPrice, toFaDigits } from "@/lib/site";
import { getApiErrorMessage } from "@/lib/orders-api";
import { StoreDialog, StoreDialogTitle } from "@/components/StoreDialog";
import {
  AttachmentPicker,
  PrivateImage,
  FavoriteButton,
} from "@/components/CustomerTools";
import { CustomerLogin } from "./CustomerLogin";
import "./customer.css";
const tabs = [
  ["overview", "خانه‌ی من", LayoutDashboard],
  ["orders", "سفارش‌های من", ShoppingBag],
  ["addresses", "آدرس‌ها", MapPin],
  ["favorites", "علاقه‌مندی‌ها", Heart],
  ["support", "پشتیبانی و درخواست‌ها", MessageCircle],
  ["reviews", "نظرهای من", Star],
  ["notifications", "اعلان‌ها", Bell],
  ["profile", "اطلاعات حساب", UserRound],
] as const;
const labels: Record<string, string> = {
  pending: "در انتظار بررسی",
  confirmed: "تأییدشده",
  processing: "در حال آماده‌سازی",
  shipped: "ارسال‌شده",
  delivered: "تحویل‌شده",
  cancelled: "لغوشده",
  waiting_admin: "منتظر پاسخ فروشگاه",
  waiting_customer: "منتظر پاسخ شما",
  closed: "بسته‌شده",
  approved: "پذیرفته‌شده",
  rejected: "پذیرفته نشد",
};
const date = (v: string) =>
  new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeZone: "Asia/Tehran",
  }).format(new Date(v));
const fail = (e: unknown) =>
  getApiErrorMessage(e, "انجام عملیات ممکن نشد. دوباره تلاش کنید.");
export function CustomerEmpty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="vc-empty">
      <Package size={32} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={`vc-status vc-status-${value}`}>
      {labels[value] ?? value}
    </span>
  );
}
function Sheet({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <StoreDialog
      id="customer-sheet"
      open
      onClose={onClose}
      layer={90}
      dismissible={!busy}
      className="varsa-customer vc-storefront vc-sheet"
    >
      <header>
        <StoreDialogTitle asChild>
          <h2>{title}</h2>
        </StoreDialogTitle>
        <button
          className="vc-icon"
          disabled={busy}
          onClick={onClose}
          aria-label="بستن"
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </StoreDialog>
  );
}
export function CaseConversation({
  item,
  onDone,
  admin = false,
}: {
  item: CustomerCase;
  onDone: () => Promise<void>;
  admin?: boolean;
}) {
  const [message, setMessage] = useState(""),
    [images, setImages] = useState<string[]>([]),
    [uploading, setUploading] = useState(false),
    [status, setStatus] = useState(
      item.kind === "ticket" ? "waiting_customer" : "waiting_customer",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const final = ["approved", "rejected"].includes(item.status);
  return (
    <div className="vc-conversation">
      <div className="vc-case-heading">
        <div>
          <strong>{item.payload.subject}</strong>
          <small>
            {date(item.createdAt)} ·{" "}
            {item.kind === "ticket"
              ? "تیکت پشتیبانی"
              : item.kind === "cancel"
                ? "درخواست لغو"
                : "درخواست مرجوعی"}
          </small>
        </div>
        {admin && item.status === "waiting_customer" ? (
          <span className="vc-status vc-status-waiting_customer">
            منتظر پاسخ مشتری
          </span>
        ) : (
          <Status value={item.status} />
        )}
      </div>
      <div className="vc-messages">
        {item.payload.messages.map((m) => (
          <article className={`vc-message vc-message-${m.author}`} key={m.id}>
            <div>
              <strong>
                {m.author === "admin" ? "پشتیبانی ورسا" : "مشتری"}
              </strong>
              <time>{date(m.createdAt)}</time>
            </div>
            <p>{m.text}</p>
            {m.images.length > 0 && (
              <div className="vc-message-images">
                {m.images.map((src) => (
                  <PrivateImage key={src} src={src} />
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
      {!final && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || uploading) return;
            setBusy(true);
            setError("");
            try {
              await customerRequest(
                admin
                  ? `/admin/customer-service/cases/${item.id}`
                  : `/customer/cases/${item.id}/reply`,
                "POST",
                { message, images, status },
              );
              setMessage("");
              setImages([]);
              await onDone();
            } catch (err) {
              setError(fail(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="vc-field">
            <span>{admin ? "پاسخ به مشتری" : "پیام شما"}</span>
            <textarea
              rows={4}
              required
              maxLength={5000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <AttachmentPicker
            images={images}
            onChange={setImages}
            onBusy={setUploading}
            customerId={admin ? item.customerId : undefined}
          />
          {admin && (
            <label className="vc-field">
              <span>نتیجه بررسی</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="waiting_customer">منتظر پاسخ مشتری</option>
                {item.kind === "ticket" ? (
                  <option value="closed">بستن تیکت</option>
                ) : (
                  <>
                    <option value="approved">پذیرش درخواست</option>
                    <option value="rejected">رد درخواست</option>
                  </>
                )}
              </select>
            </label>
          )}
          {admin && item.kind === "return" && (
            <p className="vc-hint">
              پذیرش مرجوعی به‌تنهایی وجه را بازنمی‌گرداند و موجودی را تغییر
              نمی‌دهد. نتیجه هماهنگی را در پاسخ بنویسید.
            </p>
          )}
          {error && (
            <p role="alert" className="vc-error">
              {error}
            </p>
          )}
          <button className="vc-button" disabled={busy || uploading}>
            {busy ? "در حال ذخیره…" : admin ? "ثبت پاسخ و نتیجه" : "ارسال پیام"}
            <ArrowLeft size={17} />
          </button>
        </form>
      )}
    </div>
  );
}
function NewCase({
  kind,
  orderId,
  onClose,
  onSaved,
}: {
  kind: "ticket" | "cancel" | "return";
  orderId?: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [subject, setSubject] = useState(
      kind === "cancel"
        ? "درخواست لغو سفارش"
        : kind === "return"
          ? "درخواست مرجوعی سفارش"
          : "",
    ),
    [message, setMessage] = useState(""),
    [images, setImages] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  return (
    <Sheet
      title={
        kind === "ticket"
          ? "گفت‌وگو با ورسا"
          : kind === "cancel"
            ? "درخواست لغو"
            : "درخواست مرجوعی"
      }
      onClose={onClose}
      busy={busy || uploading}
    >
      <form
        className="vc-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || uploading) return;
          setBusy(true);
          setError("");
          try {
            await customerRequest("/customer/cases", "POST", {
              kind,
              orderId: orderId ? Number(orderId) : null,
              subject,
              message,
              images,
            });
            await onSaved();
            onClose();
          } catch (err) {
            setError(fail(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="vc-field">
          <span>موضوع</span>
          <input
            required
            maxLength={200}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>
        <label className="vc-field">
          <span>
            {kind === "ticket" ? "پیام شما" : "دلیل درخواست و توضیحات"}
          </span>
          <textarea
            rows={6}
            required
            maxLength={5000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
        <AttachmentPicker
          images={images}
          onChange={setImages}
          onBusy={setUploading}
        />
        <p className="vc-hint">
          درخواست شما برای بررسی به مدیر فروشگاه ارسال می‌شود.
        </p>
        {error && (
          <p role="alert" className="vc-error">
            {error}
          </p>
        )}
        <button className="vc-button" disabled={busy || uploading}>
          {busy ? "در حال ثبت…" : "ثبت درخواست"}
          <ArrowLeft size={17} />
        </button>
      </form>
    </Sheet>
  );
}
function AddressEditor({
  value,
  onClose,
  onSaved,
}: {
  value: CustomerAddress;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { updateCustomer } = useCustomer();
  const [draft, setDraft] = useState(value),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = (key: keyof CustomerAddress, label: string, max = 120) => {
    const numeric = key === "phone" || key === "postalCode";
    return (
      <label className="vc-field" key={key}>
        <span>{label}</span>
        <input
          required
          maxLength={max}
          dir={numeric ? "ltr" : undefined}
          className={numeric ? "text-end" : undefined}
          value={String(draft[key])}
          onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))}
          inputMode={numeric ? "numeric" : undefined}
        />
      </label>
    );
  };
  return (
    <Sheet title="آدرس گیرنده" onClose={onClose} busy={busy}>
      <form
        className="vc-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            updateCustomer((await putAddress(draft)).customer);
            await onSaved();
            onClose();
          } catch (err) {
            setError(fail(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="vc-form-grid">
          {input("label", "عنوان آدرس، مثلاً خانه", 80)}
          {input("recipient", "نام گیرنده")}
          {input("phone", "موبایل گیرنده", 64)}
          {input("postalCode", "کد پستی ده‌رقمی", 10)}
          {input("province", "استان", 80)}
          {input("city", "شهر", 80)}
        </div>
        <label className="vc-field">
          <span>نشانی کامل</span>
          <textarea
            required
            rows={4}
            maxLength={700}
            value={draft.address}
            onChange={(e) =>
              setDraft((p) => ({ ...p, address: e.target.value }))
            }
          />
        </label>
        <label className="vc-checkbox">
          <input
            type="checkbox"
            checked={draft.isDefault}
            onChange={(e) =>
              setDraft((p) => ({ ...p, isDefault: e.target.checked }))
            }
          />
          آدرس پیش‌فرض
        </label>
        {error && (
          <p role="alert" className="vc-error">
            {error}
          </p>
        )}
        <button className="vc-button" disabled={busy}>
          {busy ? "در حال ذخیره…" : "ذخیره آدرس"}
          <Check size={17} />
        </button>
      </form>
    </Sheet>
  );
}
function Reorder({
  order,
  onClose,
}: {
  order: CustomerOrder;
  onClose: () => void;
}) {
  const { add, items: cart } = useCart();
  const [, navigate] = useLocation();
  const [products, setProducts] = useState<Product[] | null>(null),
    [quantities, setQuantities] = useState<Record<string, number>>({}),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetchProducts()
      .then((rows) => {
        if (!active) return;
        setProducts(rows);
        const q: Record<string, number> = {};
        for (const i of order.items) {
          const p = rows.find((p) => p.id === i.productId);
          const available = p
            ? Math.min(p.stock ?? MAX_PRODUCT_QUANTITY, MAX_PRODUCT_QUANTITY) -
              (cart.find((c) => c.product.id === p.id)?.quantity ?? 0)
            : 0;
          q[i.productId] = Math.max(0, Math.min(i.quantity, available, 99));
        }
        setQuantities(q);
      })
      .catch((e) => {
        if (active) setError(fail(e));
      });
    return () => {
      active = false;
    };
  }, [order]);
  return (
    <Sheet title="خرید دوباره با قیمت امروز" onClose={onClose}>
      <div className="vc-form">
        <p className="vc-hint">
          قیمت و موجودی فعلی را بررسی کنید. کالاهای ناموجود به سبد اضافه
          نمی‌شوند.
        </p>
        {error && (
          <p className="vc-error" role="alert">
            {error}
          </p>
        )}
        {!products ? (
          <p>در حال بررسی محصولات…</p>
        ) : (
          <>
            {order.items.map((i) => {
              const p = products.find((p) => p.id === i.productId),
                max = p
                  ? Math.max(
                      0,
                      Math.min(
                        MAX_PRODUCT_QUANTITY -
                          (cart.find((c) => c.product.id === p.id)?.quantity ??
                            0),
                        (p.stock ?? 99) -
                          (cart.find((c) => c.product.id === p.id)?.quantity ??
                            0),
                      ),
                    )
                  : 0;
              return (
                <div className="vc-reorder-row" key={i.productId}>
                  <div>
                    <strong>{p?.name ?? i.name}</strong>
                    <small>
                      {p && max > 0
                        ? formatPrice(p.price)
                        : "در حال حاضر ناموجود"}
                    </small>
                  </div>
                  <label>
                    <span className="sr-only">تعداد {i.name}</span>
                    <input
                      type="number"
                      min={0}
                      max={max}
                      disabled={!max}
                      value={quantities[i.productId] ?? 0}
                      onChange={(e) =>
                        setQuantities((q) => ({
                          ...q,
                          [i.productId]: Math.max(
                            0,
                            Math.min(max, Number(e.target.value) || 0),
                          ),
                        }))
                      }
                    />
                  </label>
                </div>
              );
            })}
            <button
              className="vc-button"
              disabled={!Object.values(quantities).some((n) => n > 0)}
              onClick={() => {
                const selectedIds = products
                  .filter((p) => quantities[p.id] > 0)
                  .map((p) => p.id);
                if (
                  new Set([...cart.map((i) => i.product.id), ...selectedIds])
                    .size > MAX_ORDER_LINES
                ) {
                  setError(
                    "تعداد محصولات متفاوت سبد بیش از حد مجاز است. ابتدا بخشی از سبد را خالی کنید.",
                  );
                  return;
                }
                for (const p of products) {
                  const n = quantities[p.id];
                  if (n > 0) add(p, n);
                }
                onClose();
                navigate(CHECKOUT_PATHS.cart);
              }}
            >
              افزودن انتخاب‌ها به سبد
              <ShoppingBag size={17} />
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
function ProfileForm() {
  const { customer, updateCustomer } = useCustomer();
  const [form, setForm] = useState({
      name: customer!.profile.name,
      email: customer!.profile.email,
      smsUpdates: customer!.profile.smsUpdates,
    }),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  return (
    <form
      className="vc-form vc-profile-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setMessage("");
        try {
          updateCustomer(
            (
              await customerRequest<{
                customer: import("@workspace/catalog").Customer;
              }>("/customer/profile", "PUT", form)
            ).customer,
          );
          setMessage("اطلاعات حساب ذخیره شد.");
        } catch (err) {
          setError(fail(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="vc-field">
        <span>شماره موبایل تأییدشده</span>
        <input dir="ltr" className="text-end" readOnly value={customer!.phone} />
      </label>
      <p className="vc-hint">
        این شماره هویت حساب شماست. برای تغییر آن با پشتیبانی هماهنگ کنید.
      </p>
      <label className="vc-field">
        <span>نام و نام خانوادگی</span>
        <input
          maxLength={120}
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />
      </label>
      <label className="vc-field">
        <span>ایمیل (اختیاری)</span>
        <input
          type="email"
          dir="ltr"
          className="text-end"
          maxLength={200}
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
        />
      </label>
      <label className="vc-checkbox">
        <input
          type="checkbox"
          checked={form.smsUpdates}
          onChange={(e) =>
            setForm((p) => ({ ...p, smsUpdates: e.target.checked }))
          }
        />
        دریافت پیامک وضعیت سفارش و پاسخ پشتیبانی
      </label>
      <p className="vc-hint">
        این انتخاب شامل پیامک تبلیغاتی نمی‌شود. اعلان‌ها همیشه در پنل قابل
        مشاهده‌اند.
      </p>
      {error && (
        <p role="alert" className="vc-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="vc-success">
          {message}
        </p>
      )}
      <button className="vc-button" disabled={busy}>
        {busy ? "در حال ذخیره…" : "ذخیره اطلاعات"}
        <Check size={17} />
      </button>
    </form>
  );
}

export function CustomerAccount() {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const account = useCustomer(),
    search = useSearch();
  const requestedView = new URLSearchParams(search).get("view");
  const trackingRequested = new URLSearchParams(search).get("track") === "1";
  const view = tabs.some((t) => t[0] === requestedView)
    ? requestedView!
    : "overview";
  useEffect(() => { setNavigationOpen(false); }, [view]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const close = () => { if (desktop.matches) setNavigationOpen(false); };
    desktop.addEventListener('change', close);
    return () => desktop.removeEventListener('change', close);
  }, []);
  const [data, setData] = useState<CustomerDashboard | null>(null),
    [products, setProducts] = useState<Product[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [order, setOrder] = useState<CustomerOrder | null>(null),
    [caseId, setCaseId] = useState<string | null>(null),
    [address, setAddress] = useState<CustomerAddress | null>(null),
    [newCase, setNewCase] = useState<{
      kind: "ticket" | "cancel" | "return";
      orderId?: string;
    } | null>(null),
    [reorder, setReorder] = useState<CustomerOrder | null>(null),
    [reviewProduct, setReviewProduct] = useState<string | null>(null),
    [rating, setRating] = useState(5),
    [reviewBody, setReviewBody] = useState(""),
    [saving, setSaving] = useState(false),
    [claim, setClaim] = useState("");
  const [claimError, setClaimError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const claimOrder = async (orderNumber: string) => {
    setClaiming(true);
    setClaimError("");
    try {
      const { orderId } = await customerRequest<{ orderId: string }>(
        "/customer/claim-order", "POST", { orderNumber },
      );
      setClaim("");
      const dashboard = await getDashboard();
      setData(dashboard);
      setOrder(dashboard.orders.find((item) => item.id === orderId) ?? null);
      setNotice("سفارش به حساب شما اضافه شد.");
    } catch (e) {
      setClaimError(fail(e));
    } finally {
      setClaiming(false);
    }
  };
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getDashboard());
    } catch (e) {
      if ((e as { status?: number }).status === 401) {
        await account.refresh();
      } else setError(fail(e));
    } finally {
      setLoading(false);
    }
  }, [account.customer?.id]);
  useEffect(() => {
    if (!account.customer) return;
    const onFocus = () => {
      void reload();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [account.customer?.id, reload]);
  useEffect(() => {
    if (account.customer) {
      window.scrollTo({ top: 0, behavior: "instant" });
      void reload();
    } else setData(null);
  }, [account.customer?.id, reload]);
  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => {});
  }, []);
  useEffect(() => {
    setNotice("");
    setError("");
  }, [view]);
  if (!account.ready)
    return (
      <main className="varsa-customer vc-storefront vc-account">
        <CustomerEmpty title="در حال دریافت حساب…">
          <Loader2 className="animate-spin" />
        </CustomerEmpty>
      </main>
    );
  if (!account.customer)
    return (
      <main className="container-luxe min-h-[75vh] pb-16 pt-28 sm:pt-32">
        {account.error && (
          <p className="mx-auto mb-4 max-w-md rounded-xl border border-crimson-500/30 bg-crimson-500/10 p-3 text-sm leading-6 text-crimson-700 dark:text-crimson-200" role="alert">
            ارتباط با حساب برقرار نشد.{" "}
            <button type="button" className="min-h-11 underline underline-offset-4" onClick={() => void account.refresh()}>تلاش مجدد</button>
          </p>
        )}
        <CustomerLogin tracking={trackingRequested ? {
          orderNumber: claim, onOrderNumberChange: setClaim, claim: claimOrder,
        } : undefined} />
      </main>
    );
  const c = account.customer,
    orders = data?.orders ?? [],
    cases = data?.cases ?? [],
    notifications = data?.notifications ?? [],
    reviews = data?.reviews ?? [];
  const current = orders.find(
    (o) => !["cancelled", "delivered"].includes(o.status),
  );
  const selectedCase = cases.find((i) => i.id === caseId);
  const deliveredProducts = [
    ...new Map(
      orders
        .filter((o) => o.status === "delivered")
        .flatMap((o) => o.items)
        .map((i) => [i.productId, i]),
    ).values(),
  ];
  const ordersList = (rows: CustomerOrder[]) =>
    rows.length ? (
      <div className="vc-orders">
        {rows.map((o) => (
          <button
            key={o.id}
            className="vc-order-row"
            onClick={() => setOrder(o)}
          >
            <div className="vc-order-thumbnails">
              {o.items.slice(0, 3).map((i) => (
                <DeliveryImage key={i.productId} src={i.imageUrl} alt="" />
              ))}
            </div>
            <div>
              <strong dir="ltr">{o.orderNumber}</strong>
              <small>
                {date(o.createdAt)} ·{" "}
                {toFaDigits(o.items.reduce((n, i) => n + i.quantity, 0))} بسته
              </small>
            </div>
            <Status value={o.status} />
            <strong className="vc-order-price">{formatPrice(o.total)}</strong>
            <ChevronLeft size={18} />
          </button>
        ))}
      </div>
    ) : (
      <CustomerEmpty title="اولین عطر را به خانه بیاورید">
        <p>سفارش‌های شما پس از خرید در اینجا نمایش داده می‌شوند.</p>
        <Link className="vc-button" href="/shop">
          دیدن محصولات
          <ArrowLeft size={17} />
        </Link>
      </CustomerEmpty>
    );
  const newAddress = () =>
    setAddress({
      id: crypto.randomUUID(),
      label: "",
      recipient: c.profile.name,
      phone: c.phone,
      province: "",
      city: "",
      address: "",
      postalCode: "",
      isDefault: !c.profile.addresses.length,
    });
  const accountNavigation = <>
    <Link href="/shop" className="vc-sidebar-brand" aria-label="بازگشت به فروشگاه ورسا"><VarsaLogo aria-hidden="true" className="vc-brand-logo" /></Link>
          <div className="vc-identity">
            <span>
              {c.profile.name?.slice(0, 1) || <UserRound size={23} />}
            </span>
            <div>
              <strong>{c.profile.name || "همراه ورسا"}</strong>
              <small><bdi dir="ltr">{toFaDigits(c.phone)}</bdi></small>
            </div>
            <ShieldCheck size={17} />
          </div>
          <nav aria-label="بخش‌های حساب مشتری">
            {tabs.map(([key, label, Icon]) => (
              <Link
                key={key}
                href={`/account?view=${key}`}
                onClick={() => setNavigationOpen(false)}
                className={view === key ? "active" : ""}
                aria-current={view === key ? "page" : undefined}
              >
                <Icon size={18} />
                <span>{label}</span>
                {key === "notifications" &&
                  notifications.some((n) => !n.readAt) && (
                    <b>
                      {toFaDigits(
                        notifications.filter((n) => !n.readAt).length,
                      )}
                    </b>
                  )}
              </Link>
            ))}
          </nav>
          <button
            className="vc-logout"
            onClick={async () => {
              try {
                await account.logout();
              } catch (e) {
                setError(fail(e));
              }
            }}
          >
            <LogOut size={17} />
            خروج از حساب
          </button>
  </>;
  const sectionTitle = tabs.find(([key]) => key === view)?.[1] ?? 'حساب من';
  const sectionDescriptions: Record<string, string> = {
    overview: 'خلاصه خریدها، سفارش‌های در جریان و دسترسی‌های سریع شما.',
    orders: 'وضعیت سفارش‌ها، جزئیات خرید و پیگیری ارسال را اینجا ببینید.',
    addresses: 'نشانی‌های تحویل را ذخیره و برای خرید بعدی آماده کنید.',
    favorites: 'انتخاب‌های محبوبتان را مرور کنید و به سبد خرید اضافه کنید.',
    support: 'درخواست تازه ثبت کنید یا گفت‌وگوهای قبلی را ادامه دهید.',
    reviews: 'تجربه خرید محصولات تحویل‌شده را با دیگران در میان بگذارید.',
    notifications: 'خبرهای مربوط به سفارش‌ها و پیام‌های حساب شما.',
    profile: 'اطلاعات شخصی و تنظیمات اطلاع‌رسانی خود را مدیریت کنید.',
  };
  return (
    <main className="varsa-customer vc-storefront vc-account vc-account-shell">
      <div className="vc-page-heading">
        <div>
          <Link href="/shop">
            فروشگاه ورسا
            <ChevronLeft size={14} />
          </Link>
          <h1>{sectionTitle}</h1>
          <p>{sectionDescriptions[view]}</p>
        </div>
        <div className="vc-heading-actions">
        <button type="button" className="vc-button vc-secondary vc-navigation-trigger" onClick={() => setNavigationOpen(true)} aria-expanded={navigationOpen} aria-controls="account-navigation" aria-haspopup="dialog"><Menu size={18}/>بخش‌های حساب</button>
        <button
          className="vc-icon"
          disabled={loading}
          aria-label="به‌روزرسانی حساب"
          onClick={() => void reload()}
        >
          <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
        </button>
        </div>
      </div>
      <StoreDialog id="account-navigation" open={navigationOpen} onClose={() => setNavigationOpen(false)} layer={65} className="varsa-customer vc-storefront vc-sidebar vc-navigation-dialog">
        <StoreDialogTitle className="sr-only">بخش‌های حساب کاربری</StoreDialogTitle>
        <button className="vc-icon vc-navigation-close" onClick={() => setNavigationOpen(false)} aria-label="بستن فهرست حساب"><X size={20}/></button>
        {accountNavigation}
      </StoreDialog>
      <div className="vc-layout">
        <aside className="vc-sidebar vc-sidebar-desktop" aria-label="ناوبری حساب کاربری">
          {accountNavigation}
        </aside>
        <div className="vc-content">
          {error && (
            <p role="alert" className="vc-error">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="vc-success">
              {notice}
            </p>
          )}
          {!data && loading ? (
            <CustomerEmpty title="در حال دریافت اطلاعات…" />
          ) : (
            <>
              {view === "overview" && (
                <>
                  <section className="vc-welcome">
                    <div>
                      <h2>
                        {c.profile.name
                          ? `${c.profile.name}، خوش آمدید`
                          : "خوش آمدید، همراه ورسا"}
                      </h2>
                      <p>
                        {current
                          ? "سفارش شما در مسیر رسیدن به لحظه‌های خوش‌عطر است."
                          : "انتخاب بعدی شما، شروع یک لحظه خوش‌عطر است."}
                      </p>
                      <Link href="/shop">
                        انتخاب از فروشگاه
                        <ArrowLeft size={18} />
                      </Link>
                    </div>
                    <DeliveryImage
                      src={`${import.meta.env.BASE_URL}photos/saffron-spoon-960.webp`}
                      alt="رشته‌های واقعی زعفران در قاشق چوبی"
                    />
                  </section>
                  <div className="vc-overview-tiles">
                    <Link href="/account?view=orders">
                      <ShoppingBag size={23} />
                      <strong>{toFaDigits(orders.length)}</strong>
                      <span>سفارش ثبت‌شده</span>
                    </Link>
                    <Link href="/account?view=favorites">
                      <Heart size={23} />
                      <strong>{toFaDigits(c.profile.favorites.length)}</strong>
                      <span>انتخاب محبوب</span>
                    </Link>
                    <Link href="/account?view=support">
                      <MessageCircle size={23} />
                      <strong>
                        {toFaDigits(
                          cases.filter(
                            (i) =>
                              !["closed", "approved", "rejected"].includes(
                                i.status,
                              ),
                          ).length,
                        )}
                      </strong>
                      <span>گفت‌وگوی باز</span>
                    </Link>
                  </div>
                  <section className="vc-panel">
                    <div className="vc-section-heading">
                      <h2>
                        {current ? "سفارش در جریان" : "تازه‌ترین سفارش‌ها"}
                      </h2>
                      <Link href="/account?view=orders">
                        همه سفارش‌ها
                        <ChevronLeft size={15} />
                      </Link>
                    </div>
                    {ordersList(current ? [current] : orders.slice(0, 2))}
                  </section>
                  <div className="vc-help-strip">
                    <MessageCircle size={24} />
                    <div>
                      <strong>پرسشی دارید؟ از خودمان بپرسید.</strong>
                      <p>
                        درباره انتخاب محصول یا سفارش، برای ورسا پیام بگذارید.
                      </p>
                    </div>
                    <button onClick={() => setNewCase({ kind: "ticket" })}>
                      شروع گفت‌وگو
                      <ArrowLeft size={18} />
                    </button>
                  </div>
                </>
              )}
              {view === "orders" && (
                <section className="vc-panel">
                  <div className="vc-section-heading">
                    <h2>سفارش‌های من</h2>
                    <span>{toFaDigits(orders.length)} سفارش</span>
                  </div>
                  <form className="vc-claim" onSubmit={(e) => {
                    e.preventDefault();
                    if (!claiming) void claimOrder(claim);
                  }}>
                    <div>
                      <h3>پیگیری سفارش مهمان</h3>
                      <p>شمارهٔ سفارشی را که با موبایل همین حساب ثبت کردید وارد کنید.</p>
                    </div>
                    <label>
                      <span className="sr-only">شمارهٔ سفارش مهمان</span>
                      <input dir="ltr" className="text-end" placeholder="VRS-…" maxLength={32} required
                        value={claim} disabled={claiming} onChange={(e) => setClaim(e.target.value)} />
                    </label>
                    <button className="vc-button vc-secondary" disabled={claiming}>
                      {claiming ? "در حال پیگیری…" : "پیگیری سفارش"}
                    </button>
                  </form>
                  {claimError && <p className="vc-error" role="alert">{claimError}</p>}
                  {ordersList(orders)}
                </section>
              )}
              {view === "addresses" && (
                <section className="vc-panel">
                  <div className="vc-section-heading">
                    <h2>آدرس‌های من</h2>
                    <button className="vc-text-button" onClick={newAddress}>
                      <Plus size={18} />
                      آدرس جدید
                    </button>
                  </div>
                  {c.profile.addresses.length ? (
                    <div className="vc-addresses">
                      {c.profile.addresses.map((a) => (
                        <article key={a.id}>
                          <div>
                            <MapPin size={21} />
                            <h3>{a.label}</h3>
                            {a.isDefault && (
                              <span className="vc-status">پیش‌فرض</span>
                            )}
                          </div>
                          <p>
                            {a.province}، {a.city}، {a.address}
                          </p>
                          <small>
                            {a.recipient} · {toFaDigits(a.phone)}
                            <br />
                            کد پستی: {toFaDigits(a.postalCode)}
                          </small>
                          <footer>
                            <button onClick={() => setAddress(a)}>
                              ویرایش آدرس
                            </button>
                            <button
                              onClick={async () => {
                                setError("");
                                try {
                                  const r = await customerRequest<{
                                    customer: import("@workspace/catalog").Customer;
                                  }>(`/customer/addresses/${a.id}`, "DELETE");
                                  account.updateCustomer(r.customer);
                                } catch (e) {
                                  setError(fail(e));
                                }
                              }}
                            >
                              حذف
                            </button>
                          </footer>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <CustomerEmpty title="نشانی دلخواهتان را ذخیره کنید">
                      <p>با ذخیره آدرس، خرید بعدی کوتاه‌تر می‌شود.</p>
                      <button className="vc-button" onClick={newAddress}>
                        افزودن آدرس
                        <Plus size={17} />
                      </button>
                    </CustomerEmpty>
                  )}
                </section>
              )}
              {view === "favorites" && (
                <section className="vc-panel">
                  <div className="vc-section-heading">
                    <h2>عطرهای محبوب من</h2>
                  </div>
                  {c.profile.favorites.length ? (
                    <div className="vc-favorites">
                      {c.profile.favorites.map((id) => {
                        const p = products.find((p) => p.id === id);
                        return (
                          <article key={id}>
                            {p ? (
                              <>
                                <Link
                                  href={`/products/${encodeURIComponent(p.slug)}`}
                                >
                                  <DeliveryImage src={p.image_url} alt={p.name} />
                                </Link>
                                <h3>{p.name}</h3>
                                <strong>{formatPrice(p.price)}</strong>
                                <div>
                                  <Link
                                    className="vc-text-button"
                                    href={`/products/${encodeURIComponent(p.slug)}`}
                                  >
                                    دیدن محصول
                                    <ArrowLeft size={16} />
                                  </Link>
                                  <FavoriteButton productId={id} />
                                </div>
                              </>
                            ) : (
                              <>
                                <h3>این محصول فعلاً در فروشگاه نیست.</h3>
                                <FavoriteButton productId={id} />
                              </>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <CustomerEmpty title="انتخاب‌های محبوبتان را نگه دارید">
                      <p>قلب کنار هر محصول را بزنید تا اینجا پیدایش کنید.</p>
                      <Link href="/shop" className="vc-button">
                        دیدن محصولات
                        <Heart size={17} />
                      </Link>
                    </CustomerEmpty>
                  )}
                </section>
              )}
              {view === "support" && (
                <section className="vc-panel">
                  <div className="vc-section-heading">
                    <h2>پشتیبانی و درخواست‌ها</h2>
                    <button
                      className="vc-text-button"
                      onClick={() => setNewCase({ kind: "ticket" })}
                    >
                      <Plus size={17} />
                      پیام جدید
                    </button>
                  </div>
                  {cases.length ? (
                    <div className="vc-case-list">
                      {cases.map((i) => (
                        <button key={i.id} onClick={() => setCaseId(i.id)}>
                          <MessageCircle size={23} />
                          <div>
                            <strong>{i.payload.subject}</strong>
                            <small>{date(i.updatedAt)}</small>
                          </div>
                          <Status value={i.status} />
                          <ChevronLeft size={18} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <CustomerEmpty title="گفت‌وگو از همین‌جا شروع می‌شود">
                      <p>
                        برای سفارش، انتخاب محصول یا هر پرسش دیگر، به ورسا پیام
                        بدهید.
                      </p>
                      <button
                        className="vc-button"
                        onClick={() => setNewCase({ kind: "ticket" })}
                      >
                        نوشتن پیام
                        <MessageCircle size={17} />
                      </button>
                    </CustomerEmpty>
                  )}
                </section>
              )}
              {view === "notifications" && (
                <section className="vc-panel">
                  <div className="vc-section-heading">
                    <h2>خبرهای حساب شما</h2>
                    <button
                      className="vc-text-button"
                      onClick={async () => {
                        try {
                          await customerRequest(
                            "/customer/notifications/read",
                            "POST",
                          );
                          await reload();
                        } catch (e) {
                          setError(fail(e));
                        }
                      }}
                    >
                      خواندم
                      <Check size={17} />
                    </button>
                  </div>
                  {notifications.length ? (
                    <div className="vc-notifications">
                      {notifications.map((n) => (
                        <article
                          key={n.id}
                          className={!n.readAt ? "unread" : ""}
                        >
                          <Bell size={20} />
                          <div>
                            <h3>{n.title}</h3>
                            <p>{n.message}</p>
                            <small>{date(n.createdAt)}</small>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <CustomerEmpty title="هنوز خبر تازه‌ای ندارید">
                      <p>
                        تغییر وضعیت سفارش و پاسخ فروشگاه در اینجا نمایش داده
                        می‌شود.
                      </p>
                    </CustomerEmpty>
                  )}
                </section>
              )}
              {view === "profile" && (
                <section className="vc-panel">
                  <div className="vc-section-heading">
                    <h2>اطلاعات حساب</h2>
                  </div>
                  <ProfileForm />
                </section>
              )}
              {view === "reviews" && (
                <section className="vc-panel">
                  <div className="vc-section-heading">
                    <h2>تجربه شما از ورسا</h2>
                  </div>
                  {deliveredProducts.length ? (
                    <div className="vc-reviewable">
                      {deliveredProducts.map((i) => {
                        const r = reviews.find(
                          (r) => r.productId === i.productId,
                        );
                        return (
                          <article key={i.productId}>
                            <DeliveryImage src={i.imageUrl} alt="" />
                            <div>
                              <h3>{i.name}</h3>
                              <p>
                                {r
                                  ? `${toFaDigits(r.rating)} از ۵ · ${r.published ? "منتشرشده" : "در انتظار بررسی"}`
                                  : "پس از تجربه عطر و طعم، نظرتان را بنویسید."}
                              </p>
                              {r && <p>{r.body}</p>}
                            </div>
                            <button
                              className="vc-text-button"
                              onClick={() => {
                                setReviewProduct(i.productId);
                                setRating(r?.rating ?? 5);
                                setReviewBody(r?.body ?? "");
                              }}
                            >
                              {r ? "ویرایش نظر" : "نوشتن نظر"}
                              <Star size={17} />
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <CustomerEmpty title="تجربه شما برایمان ارزشمند است">
                      <p>
                        پس از تحویل سفارش، می‌توانید برای محصول خریداری‌شده نظر
                        بنویسید.
                      </p>
                    </CustomerEmpty>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
      {order && data?.customer.id === c.id && (
        <Sheet title="جزئیات سفارش" onClose={() => setOrder(null)}>
          <div className="vc-order-detail">
            <div className="vc-order-title">
              <strong dir="ltr">{order.orderNumber}</strong>
              <Status value={order.status} />
            </div>
            <p className="vc-hint">{date(order.createdAt)}</p>
            <Link href={`/payment/${order.id}`} className="vc-button vc-secondary">پرداخت و پیگیری رسید</Link>
            <OrderTrackingHistory key={order.id} orderId={order.id} />
            <h3>بسته‌های سفارش</h3>
            {order.items.map((i) => (
              <div className="vc-detail-item" key={i.productId}>
                <DeliveryImage src={i.imageUrl} alt="" />
                <span>
                  {i.name}
                  <small>{toFaDigits(i.quantity)} بسته</small>
                </span>
                <strong>{formatPrice(i.quantity * i.unitPrice)}</strong>
              </div>
            ))}
            <dl className="vc-order-totals">
              <div>
                <dt>جمع کالاها</dt>
                <dd>
                  {formatPrice(order.management?.subtotal ?? order.total)}
                </dd>
              </div>
              <div>
                <dt>تخفیف</dt>
                <dd>{formatPrice(order.management?.discount ?? 0)}</dd>
              </div>
              <div>
                <dt>ارسال</dt>
                <dd>
                  {order.management?.shippingConfigured
                    ? formatPrice(order.management.shipping)
                    : "هنوز تعیین نشده"}
                </dd>
              </div>
              <div>
                <dt>مبلغ سفارش</dt>
                <dd>{formatPrice(order.total)}</dd>
              </div>
            </dl>
            <h3>گیرنده و نشانی ثبت‌شده</h3>
            <p>
              {order.customerName}
              <br />
              {order.address}
            </p>
            <div className="vc-detail-actions">
              <button
                className="vc-button"
                onClick={() => {
                  setReorder(order);
                  setOrder(null);
                }}
              >
                خرید دوباره
                <ShoppingBag size={17} />
              </button>
              <button
                className="vc-button vc-secondary"
                onClick={() => {
                  setNewCase({ kind: "ticket", orderId: order.id });
                  setOrder(null);
                }}
              >
                پشتیبانی سفارش
                <MessageCircle size={17} />
              </button>
              {["pending", "confirmed", "processing"].includes(
                order.status,
              ) && (
                <button
                  className="vc-text-button"
                  onClick={() => {
                    setNewCase({ kind: "cancel", orderId: order.id });
                    setOrder(null);
                  }}
                >
                  درخواست لغو سفارش
                </button>
              )}
              {order.status === "delivered" &&
                Date.now() <
                  Date.parse(order.management?.deliveredAt ?? order.updatedAt) +
                    (data?.returnWindowDays ?? 7) * 86400000 && (
                  <button
                    className="vc-text-button"
                    onClick={() => {
                      setNewCase({ kind: "return", orderId: order.id });
                      setOrder(null);
                    }}
                  >
                    درخواست مرجوعی
                  </button>
                )}
            </div>
          </div>
        </Sheet>
      )}
      {selectedCase && (
        <Sheet title="گفت‌وگو و پیگیری درخواست" onClose={() => setCaseId(null)}>
          <CaseConversation item={selectedCase} onDone={reload} />
        </Sheet>
      )}
      {newCase && (
        <NewCase
          {...newCase}
          onClose={() => setNewCase(null)}
          onSaved={async () => {
            await reload();
            setNotice("درخواست شما ثبت شد و در بخش پشتیبانی قابل پیگیری است.");
          }}
        />
      )}
      {address && (
        <AddressEditor
          value={address}
          onClose={() => setAddress(null)}
          onSaved={reload}
        />
      )}
      {reorder && <Reorder order={reorder} onClose={() => setReorder(null)} />}
      {reviewProduct && (
        <Sheet
          title="نظر شما درباره محصول"
          onClose={() => setReviewProduct(null)}
          busy={saving}
        >
          <form
            className="vc-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              setError("");
              try {
                await customerRequest(
                  `/customer/reviews/${reviewProduct}`,
                  "PUT",
                  { rating, body: reviewBody },
                );
                await reload();
                setReviewProduct(null);
                setNotice("نظر شما برای بررسی و انتشار ارسال شد.");
              } catch (err) {
                setError(fail(err));
              } finally {
                setSaving(false);
              }
            }}
          >
            <label className="vc-field">
              <span>امتیاز شما</span>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {toFaDigits(n)} از ۵
                  </option>
                ))}
              </select>
            </label>
            <label className="vc-field">
              <span>تجربه خرید و استفاده</span>
              <textarea
                required
                maxLength={3000}
                rows={6}
                value={reviewBody}
                onChange={(e) => setReviewBody(e.target.value)}
              />
            </label>
            {error && (
              <p className="vc-error" role="alert">
                {error}
              </p>
            )}
            <button className="vc-button" disabled={saving}>
              ثبت نظر
              <Check size={17} />
            </button>
          </form>
        </Sheet>
      )}
    </main>
  );
}
