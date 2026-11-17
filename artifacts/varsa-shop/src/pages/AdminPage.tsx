import { VarsaMark, VarsaLogo } from '@/components/Brand';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useSearch } from "wouter";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  TicketPercent,
  FileText,
  Images,
  Settings,
  ArrowUpLeft,
  LogOut,
  Search,
  Plus,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Printer,
  Upload,
  Check,
  Menu,
  AlertCircle,
  Loader2,
  Sprout,
  MessageCircle,
} from "lucide-react";
import type {
  ManagementState,
  ManagedProduct,
  ManagedArticle,
  Coupon,
  Banner,
  StoreSettings,
} from "@workspace/catalog";
import { AdminLogin } from "./AdminLogin";
import { AdminSecurity } from './AdminSecurity';
import {
  signOutAdmin,
  readAdminSession,
  getApiErrorMessage,
} from "@/lib/orders-api";
import {
  readManagement,
  readOrders,
  saveManagement,
  saveFulfillment,
  importArticles,
  uploadImage,
  type AdminOrder,
} from "@/lib/management-api";
import { formatPrice, toFaDigits } from "@/lib/site";
import { StoreDialog, StoreDialogTitle } from "@/components/StoreDialog";
import "./admin.css";
import { AdminCustomerService } from "./AdminCustomerService";

const sections = [
  ["overview", "نمای کلی", LayoutDashboard],
  ["orders", "سفارش‌ها", ShoppingBag],
  ["products", "محصولات", Package],
  ["customers", "مشتری‌ها", Users],
  ["service", "خدمات مشتری", MessageCircle],
  ["coupons", "کدهای تخفیف", TicketPercent],
  ["articles", "مجله دلگشا", FileText],
  ["banners", "بنرهای فروشگاه", Images],
  ["settings", "تنظیمات", Settings],
] as const;
type Section = (typeof sections)[number][0];
type Editable = "products" | "coupons" | "articles" | "banners" | "settings";
type Entity = ManagedProduct | ManagedArticle | Coupon | Banner | StoreSettings;
const statuses: Record<string, string> = {
  pending: "در انتظار بررسی",
  confirmed: "تأییدشده",
  processing: "در حال آماده‌سازی",
  shipped: "ارسال‌شده",
  delivered: "تحویل‌شده",
  cancelled: "لغوشده",
};
const date = (v: string) =>
  new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeZone: "Asia/Tehran",
  }).format(new Date(v));
const errorText = (e: unknown) =>
  getApiErrorMessage(e, "انجام عملیات ممکن نشد. دوباره تلاش کنید.");
function Status({ value }: { value: string }) {
  return (
    <span className={`adm-status adm-status-${value}`}>
      {statuses[value] ?? value}
    </span>
  );
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="adm-empty">
      <Sprout size={32} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "adm-field adm-wide" : "adm-field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Close({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="adm-icon"
      onClick={onClick}
      aria-label="بستن"
    >
      <X size={20} />
    </button>
  );
}

function Editor({
  collection,
  value,
  revision,
  onSave,
  onClose,
  onUnauthorized,
}: {
  collection: Editable;
  value: Entity;
  revision: number;
  onSave: (s: ManagementState) => void;
  onClose: () => void;
  onUnauthorized: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>({
    ...(collection === "settings"
      ? { returnWindowDays: 7, transactionalSmsEnabled: false }
      : {}),
    ...value,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const update = (key: string, v: unknown) =>
    setDraft((p) => ({ ...p, [key]: v }));
  const text = (
    key: string,
    label: string,
    opts: {
      type?: string;
      required?: boolean;
      wide?: boolean;
      max?: number;
    } = {},
  ) => (
    <Field key={key} label={label} wide={opts.wide}>
      <input
        type={opts.type ?? "text"}
        value={String(draft[key] ?? "")}
        required={opts.required ?? false}
        maxLength={opts.max ?? 2000}
        onChange={(e) => update(key, e.target.value)}
        dir={opts.type === "url" ? "ltr" : undefined}
      />
    </Field>
  );
  const number = (
    key: string,
    label: string,
    opts: {
      nullable?: boolean;
      step?: string;
      max?: number;
      min?: number;
    } = {},
  ) => (
    <Field key={key} label={label}>
      <input
        type="number"
        inputMode="decimal"
        min={opts.min ?? 0}
        max={opts.max ?? 2147483647}
        step={opts.step ?? "1"}
        value={draft[key] === null ? "" : Number(draft[key] ?? 0)}
        required={!opts.nullable}
        onChange={(e) =>
          update(
            key,
            opts.nullable && !e.target.value ? null : Number(e.target.value),
          )
        }
      />
      {opts.nullable && (
        <small>خالی یعنی موجودی هنوز تعیین نشده؛ فروش محدود نمی‌شود.</small>
      )}
    </Field>
  );
  const toggle = (key: string, label: string) => (
    <label className="adm-toggle" key={key}>
      <input
        type="checkbox"
        checked={Boolean(draft[key])}
        onChange={(e) => update(key, e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
  const area = (key: string, label: string, rows = 4, required = false) => (
    <Field key={key} label={label} wide>
      <textarea
        rows={rows}
        value={String(draft[key] ?? "")}
        required={required}
        maxLength={key === "content" ? 100000 : 20000}
        onChange={(e) => update(key, e.target.value)}
      />
    </Field>
  );
  const imageKey = collection === "banners" ? "image" : "image_url";
  const image = (
    <div className="adm-upload adm-wide">
      {Boolean(draft[imageKey]) && (
        <img src={String(draft[imageKey])} alt="پیش‌نمایش تصویر" />
      )}
      <div>
        {text(imageKey, "نشانی تصویر", { required: true })}
        <label className="adm-button adm-secondary">
          <Upload size={16} />
          {uploading ? "در حال بارگذاری…" : "انتخاب تصویر"}
          <input
            className="adm-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading || saving}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              setError("");
              try {
                update(imageKey, await uploadImage(file));
              } catch (err) {
                setError(errorText(err));
                if ((err as { status?: number }).status === 401)
                  onUnauthorized();
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
        <small>PNG، JPG یا WebP، حداکثر ۴ مگابایت</small>
      </div>
    </div>
  );
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current || uploading) return;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      onSave(
        await saveManagement(
          collection,
          String(draft.id ?? "main"),
          draft,
          revision,
        ),
      );
    } catch (err) {
      setError(errorText(err));
      if ((err as { status?: number }).status === 401) onUnauthorized();
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  return (
    <StoreDialog
      id="admin-editor"
      open
      onClose={onClose}
      layer={90}
      dismissible={!saving && !uploading}
      className="varsa-admin adm-editor"
    >
      <form onSubmit={save}>
        <header>
          <div>
            <StoreDialogTitle asChild>
              <h2>{sections.find((s) => s[0] === collection)?.[1]}</h2>
            </StoreDialogTitle>
            <p>اطلاعات را ویرایش و ذخیره کنید.</p>
          </div>
          <Close
            onClick={() => {
              if (!saving && !uploading) onClose();
            }}
          />
        </header>
        <fieldset disabled={saving || uploading} className="adm-form-grid">
          {collection === "products" && (
            <>
              {text("name", "نام محصول", {
                required: true,
                wide: true,
                max: 200,
              })}
              {text("slug", "نشانی محصول (بدون فاصله)", {
                required: true,
                max: 200,
              })}
              <Field label="دسته‌بندی">
                <select
                  value={String(draft.category)}
                  onChange={(e) => update("category", e.target.value)}
                >
                  {[
                    "سوپر نگین",
                    "نگین",
                    "شبه نگین",
                    "سرگل",
                    "پوشال",
                    "رشته",
                    "هدیه",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              {number("price", "قیمت (تومان)")}
              {number("stock", "تعداد موجودی", { nullable: true })}
              {number("weight", "وزن", { step: "0.01", min: 0.01 })}
              {text("weight_unit", "واحد وزن", { required: true })}
              {image}
              {area("short_description", "توضیح کوتاه", 3, true)}
              {area("long_description", "توضیحات کامل")}
              {number("crocin", "کروسین", { max: 1000 })}
              {number("picrocrocin", "پیکروکروسین", { max: 1000 })}
              {number("safranal", "سافرانال", { max: 1000 })}
              {number("sort_order", "ترتیب نمایش")}
              {toggle("active", "نمایش در فروشگاه")}
              {toggle("is_featured", "محصول منتخب صفحه اصلی")}
            </>
          )}
          {collection === "coupons" && (
            <>
              {text("code", "کد تخفیف (حروف لاتین)", {
                required: true,
                max: 50,
              })}
              <Field label="نوع تخفیف">
                <select
                  value={String(draft.kind)}
                  onChange={(e) => update("kind", e.target.value)}
                >
                  <option value="percent">درصدی</option>
                  <option value="fixed">مبلغی (تومان)</option>
                </select>
              </Field>
              {number(
                "value",
                draft.kind === "percent" ? "درصد تخفیف" : "مبلغ تخفیف (تومان)",
                { min: 1, max: draft.kind === "percent" ? 100 : 2147483647 },
              )}
              {number("minimum", "حداقل خرید (تومان)")}
              {number("limit", "سقف استفاده (صفر = بدون سقف)")}
              <Field label="تاریخ انقضا (اختیاری)">
                <input
                  type="date"
                  value={String(draft.expiresAt ?? "").slice(0, 10)}
                  onChange={(e) =>
                    update(
                      "expiresAt",
                      e.target.value ? `${e.target.value}T20:29:59.999Z` : "",
                    )
                  }
                />
              </Field>
              {toggle("active", "کد تخفیف فعال باشد")}
            </>
          )}
          {collection === "articles" && (
            <>
              {text("title", "عنوان مقاله", {
                required: true,
                wide: true,
                max: 200,
              })}
              {text("slug", "نشانی مقاله (بدون فاصله)", {
                required: true,
                max: 200,
              })}
              {text("author", "نویسنده", { required: true, max: 120 })}
              {text("category", "دسته مقاله", { required: true, max: 120 })}
              {number("read_time", "زمان مطالعه (دقیقه)", { max: 999 })}
              {image}
              {area("excerpt", "خلاصه مقاله", 3, true)}
              {area("content", "متن مقاله", 14, true)}
              <p className="adm-hint adm-wide">
                برای پاراگراف جدید یک خط خالی بگذارید. عنوان بخش را با ## شروع
                کنید.
              </p>
              {toggle("published", "انتشار در مجله (خاموش = پیش‌نویس)")}
            </>
          )}
          {collection === "banners" && (
            <>
              {text("title", "عنوان بنر", {
                required: true,
                wide: true,
                max: 200,
              })}
              {text("eyebrow", "متن کوتاه بالای عنوان", { max: 200 })}
              {text("link", "لینک دکمه بنر", { required: true })}
              {image}
              {area("subtitle", "توضیح بنر", 3)}
              {toggle("active", "نمایش در صفحه اصلی")}
            </>
          )}
          {collection === "settings" && (
            <>
              {text("phone", "تلفن تماس")}
              {text("email", "ایمیل", { type: "email" })}
              {area("address", "نشانی")}
              {text("instagram", "لینک اینستاگرام", { type: "url" })}
              {text("telegram", "لینک تلگرام", { type: "url" })}
              <div className="adm-wide adm-subheading">خدمات مشتری</div>
              {number(
                "returnWindowDays",
                "مهلت درخواست مرجوعی پس از تحویل (روز)",
                { max: 365 },
              )}
              {toggle(
                "transactionalSmsEnabled",
                "ارسال پیامک وضعیت برای مشتریان مایل به دریافت",
              )}
              <p className="adm-hint adm-wide">
                پیامک پس از تنظیم سرویس روی میزبان ارسال می‌شود. اعلان داخل پنل
                همیشه فعال است.
              </p>
              <div className="adm-wide adm-subheading">هزینه ارسال</div>
              {toggle(
                "shippingEnabled",
                "هزینه ارسال تنظیم شده و در سفارش محاسبه شود",
              )}
              {number("shippingFee", "هزینه ثابت ارسال (تومان)")}
              {number(
                "freeShippingAbove",
                "ارسال رایگان از مبلغ (صفر = غیرفعال)",
              )}
              <p className="adm-hint adm-wide">
                حد نصاب ارسال رایگان بر اساس مبلغ کالاها پس از تخفیف است.
              </p>
            </>
          )}
        </fieldset>
        <footer>
          {error && (
            <p role="alert" className="adm-error">
              {error}
            </p>
          )}
          <div>
            <button
              className="adm-button"
              type="submit"
              disabled={saving || uploading}
            >
              {saving ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Check size={17} />
              )}
              ذخیره تغییرات
            </button>
            <button
              className="adm-button adm-secondary"
              type="button"
              disabled={saving || uploading}
              onClick={onClose}
            >
              انصراف
            </button>
          </div>
        </footer>
      </form>
    </StoreDialog>
  );
}

function OrderDetail({
  order,
  onClose,
  onSaved,
}: {
  order: AdminOrder;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [status, setStatus] = useState(order.status);
  const [tracking, setTracking] = useState(
    order.management?.trackingCode ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <StoreDialog
      id="admin-order-detail"
      open
      onClose={onClose}
      layer={90}
      dismissible={!busy}
      className="varsa-admin adm-editor adm-order-detail"
    >
      <header>
        <div>
          <StoreDialogTitle asChild>
            <h2>جزئیات سفارش</h2>
          </StoreDialogTitle>
          <p dir="ltr">{order.orderNumber}</p>
        </div>
        <Close
          onClick={() => {
            if (!busy) onClose();
          }}
        />
      </header>
      <div className="adm-order-paper">
        <div className="adm-order-heading">
          <VarsaLogo tone="rust" className="adm-brand-logo" />
          <Status value={order.status} />
        </div>
        <p>{date(order.createdAt)}</p>
        <h3>{order.customerName}</h3>
        <p dir="ltr" className="adm-phone">
          {order.phone}
        </p>
        <p>{order.address}</p>
        <table>
          <thead>
            <tr>
              <th>محصول</th>
              <th>تعداد</th>
              <th>مبلغ</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.productId}>
                <td>{i.name}</td>
                <td>{toFaDigits(i.quantity)}</td>
                <td>{formatPrice(i.unitPrice * i.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {order.management && (
          <dl className="adm-price-breakdown">
            <div>
              <dt>جمع کالاها</dt>
              <dd>{formatPrice(order.management.subtotal)}</dd>
            </div>
            <div>
              <dt>تخفیف {order.management.couponCode}</dt>
              <dd>{formatPrice(order.management.discount)}</dd>
            </div>
            <div>
              <dt>ارسال</dt>
              <dd>
                {order.management.shippingConfigured
                  ? formatPrice(order.management.shipping)
                  : "هنوز تعیین نشده"}
              </dd>
            </div>
          </dl>
        )}
        <div className="adm-order-total">
          <span>مبلغ سفارش</span>
          <strong>{formatPrice(order.total)}</strong>
        </div>
        <p className="adm-hint">این برگه رسید پرداخت نیست.</p>
      </div>
      <form
        className="adm-fulfillment"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await saveFulfillment(order.id, status, tracking);
            await onSaved();
            onClose();
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="وضعیت سفارش">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            disabled={busy}
          >
            {Object.entries(statuses).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="کد رهگیری مرسوله">
          <input
            value={tracking}
            maxLength={100}
            onChange={(e) => setTracking(e.target.value)}
            disabled={busy}
          />
        </Field>
        {error && (
          <p className="adm-error" role="alert">
            {error}
          </p>
        )}
        <div className="adm-actions">
          <button className="adm-button" disabled={busy}>
            {busy ? "در حال ذخیره…" : "ذخیره وضعیت و رهگیری"}
          </button>
          <button
            type="button"
            className="adm-button adm-secondary"
            onClick={() => window.print()}
          >
            <Printer size={16} />
            چاپ سفارش
          </button>
        </div>
      </form>
    </StoreDialog>
  );
}

export function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession,setCheckingSession]=useState(true);
  useEffect(()=>{
    let active=true;
    readAdminSession().then(session=>{if(active)setAuthenticated(session.authenticated);})
      .catch(()=>{}).finally(()=>{if(active)setCheckingSession(false);});
    return()=>{active=false;};
  },[]);
  const searchParams = useSearch();
  const requested = new URLSearchParams(searchParams).get("section");
  const section = (
    sections.some((s) => s[0] === requested) ? requested : "overview"
  ) as Section;
  const [state, setState] = useState<ManagementState | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [mobile, setMobile] = useState(false);
  const [editor, setEditor] = useState<{
    collection: Editable;
    value: Entity;
    revision: number;
  } | null>(null);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const customer = new URLSearchParams(searchParams).get("customer");
  const logout = useCallback(async () => {
    try { await signOutAdmin(); } catch { setError('خروج انجام نشد؛ دوباره تلاش کنید.'); return; }
    setAuthenticated(false);
    setState(null);
    setOrders([]);
    setEditor(null);
    setSelected(null);
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, o] = await Promise.all([readManagement(), readOrders()]);
      setState(s);
      setOrders(o);
      setUpdated(new Date());
    } catch (err) {
      if ((err as { status?: number }).status === 401) logout();
      else setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [logout]);
  useEffect(() => {
    if (authenticated) void load();
  }, [authenticated, load]);
  useEffect(() => {
    setQuery("");
    setPage(1);
    setFilter("all");
    setMobile(false);
  }, [section]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 761px)');
    const resize = () => { if (desktop.matches) setMobile(false); };
    desktop.addEventListener('change', resize);
    return () => desktop.removeEventListener('change', resize);
  }, []);
  const customers = useMemo(() => {
    const map = new Map<
      string,
      {
        phone: string;
        name: string;
        count: number;
        total: number;
        last: string;
      }
    >();
    for (const o of orders) {
      const c = map.get(o.phone) ?? {
        phone: o.phone,
        name: o.customerName,
        count: 0,
        total: 0,
        last: o.createdAt,
      };
      c.count++;
      if (o.status !== "cancelled") c.total += o.total;
      map.set(o.phone, c);
    }
    return [...map.values()];
  }, [orders]);
  if(checkingSession)return <main className="min-h-screen flex items-center justify-center" role="status">در حال بررسی نشست…</main>;
  if (!authenticated)
    return (
      <div className="varsa-admin adm-login">
        <AdminLogin onSuccess={()=>setAuthenticated(true)} />
      </div>
    );
  const edit = (collection: Editable, value: Entity) => {
    if (state) setEditor({ collection, value, revision: state.revision });
  };
  const newEntity = () => {
    const id = crypto.randomUUID();
    if (section === "products")
      edit("products", {
        id,
        slug: "",
        name: "",
        category: "نگین",
        short_description: "",
        long_description: "",
        crocin: 0,
        picrocrocin: 0,
        safranal: 0,
        weight: 1,
        weight_unit: "گرم",
        price: 0,
        image_url: "",
        is_featured: false,
        sort_order: state?.products.length ?? 0,
        active: true,
        stock: null,
      });
    if (section === "coupons")
      edit("coupons", {
        id,
        code: "",
        kind: "percent",
        value: 10,
        minimum: 0,
        expiresAt: "",
        limit: 0,
        used: 0,
        active: true,
      });
    if (section === "articles")
      edit("articles", {
        id,
        slug: "",
        title: "",
        excerpt: "",
        content: "",
        image_url: "",
        author: "ورسا",
        category: "دانستنی‌های زعفران",
        read_time: 5,
        created_at: new Date().toISOString(),
        published: false,
      });
    if (section === "banners")
      edit("banners", {
        id,
        image: "",
        eyebrow: "",
        title: "",
        subtitle: "",
        link: "/shop",
        active: true,
      });
  };
  const match = (v: unknown) =>
    String(v)
      .toLocaleLowerCase("fa")
      .includes(query.trim().toLocaleLowerCase("fa"));
  const filteredOrders = orders.filter(
    (o) =>
      (!customer || o.phone === customer) &&
      (filter === "all" || o.status === filter) &&
      match(
        `${o.orderNumber} ${o.customerName} ${o.phone} ${toFaDigits(o.phone)}`,
      ),
  );
  const orderTable = (list: AdminOrder[], compact = false) =>
    list.length ? (
      <div className="adm-table-wrap" role="region" aria-label="جدول اطلاعات مدیریت" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>سفارش / مشتری</th>
              <th>تاریخ ثبت</th>
              <th>مبلغ سفارش</th>
              <th>وضعیت</th>
              <th>
                <span className="sr-only">مشاهده</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(compact
              ? list.slice(0, 5)
              : list.slice((page - 1) * 20, page * 20)
            ).map((o) => (
              <tr key={o.id}>
                <td>
                  <button
                    className="adm-order-link"
                    onClick={() => setSelected(o)}
                  >
                    {o.customerName}
                    <small dir="ltr">{o.orderNumber}</small>
                  </button>
                </td>
                <td data-label="تاریخ ثبت">{date(o.createdAt)}</td>
                <td data-label="مبلغ" className="adm-money">
                  {formatPrice(o.total)}
                </td>
                <td data-label="وضعیت">
                  <Status value={o.status} />
                </td>
                <td>
                  <button
                    className="adm-icon"
                    aria-label={`مشاهده سفارش ${o.orderNumber}`}
                    onClick={() => setSelected(o)}
                  >
                    <ChevronLeft size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty title="سفارشی پیدا نشد">
        <p>سفارش‌های ثبت‌شده فروشگاه در این بخش نمایش داده می‌شوند.</p>
      </Empty>
    );
  const activeOrders = orders.filter((o) => o.status !== "cancelled");
  const lowStock =
    state?.products.filter(
      (p) => p.active && p.stock !== null && p.stock <= 5,
    ) ?? [];
  const pending = orders.filter((o) => o.status === "pending").length;
  const currentTitle = sections.find((s) => s[0] === section)![1];
  const count =
    section === "orders"
      ? filteredOrders.length
      : section === "products"
        ? (state?.products.filter((p) => match(p.name + " " + p.category))
            .length ?? 0)
        : section === "customers"
          ? customers.filter((c) => match(c.name + " " + c.phone)).length
          : section === "coupons"
            ? (state?.coupons.filter((c) => match(c.code)).length ?? 0)
            : section === "articles"
              ? (state?.articles?.filter((a) => match(a.title)).length ?? 0)
              : section === "banners"
                ? (state?.banners.filter((b) => match(b.title)).length ?? 0)
                : 0;
  const sidebarContent = <>
        <Link href="/admin" className="adm-brand">
          <VarsaMark tone="rust" aria-hidden="true" className="adm-brand-monogram" />
          <div>
            <VarsaLogo tone="rust" className="adm-brand-logo" />
            <small>مدیریت فروشگاه</small>
          </div>
        </Link>
        <div className="adm-sidebar-rule" />
        <nav>
          {sections.map(([key, label, Icon]) => (
            <Link
              key={key}
              href={`/admin?section=${key}`}
              aria-current={section === key ? "page" : undefined}
              className={section === key ? "active" : ""}
            >
              <Icon size={19} strokeWidth={1.6} />
              <span>{label}</span>
              {key === "orders" && pending > 0 && <b>{toFaDigits(pending)}</b>}
            </Link>
          ))}
        </nav>
        <div className="adm-sidebar-bottom">
          <div className="adm-profile">
            <span>م</span>
            <div>
              <strong>مدیر فروشگاه</strong>
              <small>دسترسی کامل</small>
            </div>
            <button
              className="adm-icon"
              aria-label="خروج از پنل"
              onClick={logout}
            >
              <LogOut size={18} />
            </button>
          </div>
          <Link href="/" className="adm-store-link">
            مشاهده فروشگاه
            <ArrowUpLeft size={17} />
          </Link>
        </div>
  </>;
  return (
    <div className="varsa-admin admin-shell" dir="rtl">
      <aside
        className="adm-sidebar adm-sidebar-desktop"
        aria-label="بخش‌های مدیریت"
      >
        {sidebarContent}
      </aside>
      <StoreDialog id="management-menu" open={mobile} onClose={() => setMobile(false)} layer={60}
        className="varsa-admin adm-sidebar adm-sidebar-open adm-sidebar-dialog">
        <StoreDialogTitle className="sr-only">بخش‌های مدیریت</StoreDialogTitle>
        <button className="adm-icon adm-sidebar-close" aria-label="بستن منو" onClick={() => setMobile(false)}><X size={20} /></button>
        {sidebarContent}
      </StoreDialog>
      <div className="adm-main">
        <header className="adm-topbar">
          <div>
            <button
              className="adm-icon adm-menu"
              onClick={() => setMobile(!mobile)}
              aria-label="باز کردن منو"
              aria-expanded={mobile}
              aria-controls="management-menu"
              aria-haspopup="dialog"
            >
              <Menu size={22} />
            </button>
            <span>فروشگاه ورسا</span>
            <ChevronLeft size={14} />
            <strong>{currentTitle}</strong>
          </div>
          <div>
            <span className="adm-today">{date(new Date().toISOString())}</span>
            <button
              className="adm-icon"
              onClick={() => void load()}
              disabled={loading}
              aria-label="به‌روزرسانی اطلاعات"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>
        <main className="adm-content">
          <div className="adm-page-heading">
            <div>
              <h1>
                {section === "overview" ? "روز تازه، عطر تازه" : currentTitle}
              </h1>
              <p>
                {section === "overview"
                  ? "نبض فروشگاه ورسا؛ از سفارش‌های تازه تا موجودی قفسه‌ها."
                  : "اطلاعات فروشگاه را از همین‌جا مدیریت کنید."}
              </p>
            </div>
            {["products", "coupons", "articles", "banners"].includes(
              section,
            ) && (
              <button
                className="adm-button"
                onClick={newEntity}
                disabled={!state}
              >
                <Plus size={18} />
                {section === "products"
                  ? "افزودن محصول"
                  : section === "coupons"
                    ? "ساخت کد تخفیف"
                    : section === "articles"
                      ? "نوشتن مقاله"
                      : "افزودن بنر"}
              </button>
            )}
          </div>
          {error && (
            <div className="adm-error adm-alert" role="alert">
              <AlertCircle size={19} />
              <span>{error}</span>
              <button onClick={() => void load()}>تلاش مجدد</button>
            </div>
          )}
          {notice && (
            <div className="adm-notice" role="status">
              <Check size={18} />
              {notice}
              <button
                className="adm-icon"
                onClick={() => setNotice("")}
                aria-label="بستن پیام"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!state ? (
            <div className="adm-panel">
              <Empty
                title={
                  loading
                    ? "در حال دریافت اطلاعات فروشگاه…"
                    : "اطلاعات فروشگاه در دسترس نیست"
                }
              >
                {loading && <Loader2 className="animate-spin" />}
              </Empty>
            </div>
          ) : (
            <>
              {section === "service" && <AdminCustomerService />}
              {section === "overview" && (
                <>
                  <section className="adm-stats" aria-label="خلاصه فروشگاه">
                    <div className="adm-stat-primary">
                      <span>سفارش‌های منتظر بررسی</span>
                      <strong>{toFaDigits(pending)}</strong>
                      <Link href="/admin?section=orders">
                        رسیدگی به سفارش‌ها
                        <ArrowLeft size={18} />
                      </Link>
                      <ShoppingBag className="adm-stat-watermark" />
                    </div>
                    <div>
                      <span>مجموع مبلغ سفارش‌ها</span>
                      <strong className="adm-stat-amount">
                        {toFaDigits(
                          activeOrders
                            .reduce((sum, o) => sum + o.total, 0)
                            .toLocaleString("en-US"),
                        )}
                        <small>تومان</small>
                      </strong>
                      <p>بدون سفارش‌های لغوشده؛ درآمد پرداخت‌شده نیست.</p>
                    </div>
                    <div>
                      <span>محصولات فروشگاه</span>
                      <strong>
                        {toFaDigits(
                          state.products.filter((p) => p.active).length,
                        )}
                      </strong>
                      <p>
                        {toFaDigits(lowStock.length)} محصول با موجودی کم یا
                        تمام‌شده
                      </p>
                    </div>
                    <div>
                      <span>مشتری‌های ورسا</span>
                      <strong>{toFaDigits(customers.length)}</strong>
                      <p>بر اساس شماره موبایل سفارش‌ها</p>
                    </div>
                  </section>
                  <div className="adm-overview-grid">
                    <section className="adm-panel">
                      <div className="adm-panel-heading">
                        <div>
                          <h2>سفارش‌های تازه</h2>
                          <p>آخرین سفارش‌های ثبت‌شده در فروشگاه</p>
                        </div>
                        <Link href="/admin?section=orders">
                          همه سفارش‌ها
                          <ChevronLeft size={16} />
                        </Link>
                      </div>
                      {orderTable(orders, true)}
                    </section>
                    <section className="adm-panel adm-inventory">
                      <div className="adm-panel-heading">
                        <div>
                          <h2>وقت پُر کردن قفسه‌هاست</h2>
                          <p>محصولات با موجودی ۵ بسته یا کمتر</p>
                        </div>
                        <Package size={22} />
                      </div>
                      {lowStock.length ? (
                        lowStock.slice(0, 5).map((p) => (
                          <button
                            key={p.id}
                            className="adm-stock-row"
                            onClick={() => edit("products", p)}
                          >
                            <img src={p.image_url} alt="" />
                            <span>
                              {p.name}
                              <small>
                                {p.stock === 0
                                  ? "ناموجود"
                                  : `${toFaDigits(p.stock!)} بسته باقی‌مانده`}
                              </small>
                            </span>
                            <ChevronLeft size={16} />
                          </button>
                        ))
                      ) : (
                        <Empty title="کمبود موجودی ثبت نشده">
                          <p>
                            {state.products.some((p) => p.stock === null)
                              ? "موجودی اولیه محصولات را از بخش محصولات وارد کنید."
                              : "موجودی محصولات در وضعیت مناسبی است."}
                          </p>
                        </Empty>
                      )}
                      <Link
                        className="adm-text-link"
                        href="/admin?section=products"
                      >
                        مدیریت موجودی
                        <ArrowLeft size={16} />
                      </Link>
                    </section>
                  </div>
                  <section className="adm-panel adm-week">
                    <div>
                      <h2>سفارش‌ها در هفت روز اخیر</h2>
                      <p>مبلغ سفارش‌ها پس از تخفیف و ارسال، بدون لغوشده‌ها</p>
                    </div>
                    <p className="adm-chart-hint">برای دیدن همه روزها، نمودار را افقی حرکت دهید.</p>
                    <div className="adm-chart-scroll" role="region" aria-label="نمودار مبلغ سفارش‌های هفت روز اخیر" tabIndex={0}>
                    <div className="adm-bars">
                      {Array.from({ length: 7 }, (_, i) => {
                        const day = new Date();
                        day.setUTCDate(day.getUTCDate() - (6 - i));
                        const key = new Intl.DateTimeFormat("en-CA", {
                          timeZone: "Asia/Tehran",
                        }).format(day);
                        const sums = Array.from({ length: 7 }, (_, j) => {
                          const d = new Date();
                          d.setUTCDate(d.getUTCDate() - (6 - j));
                          const k = new Intl.DateTimeFormat("en-CA", {
                            timeZone: "Asia/Tehran",
                          }).format(d);
                          return activeOrders
                            .filter(
                              (o) =>
                                new Intl.DateTimeFormat("en-CA", {
                                  timeZone: "Asia/Tehran",
                                }).format(new Date(o.createdAt)) === k,
                            )
                            .reduce((s, o) => s + o.total, 0);
                        });
                        const sum = sums[i];
                        return (
                          <div
                            key={key}
                            className="adm-bar-item"
                            title={`${date(day.toISOString())}: ${formatPrice(sum)}`}
                          >
                            <small>{formatPrice(sum)}</small>
                            <div className="adm-bar-track">
                              <span
                                style={{
                                  height: sum
                                    ? `${Math.max(4, (sum / Math.max(...sums, 1)) * 100)}%`
                                    : "0%",
                                }}
                              />
                            </div>
                            <span>
                              {new Intl.DateTimeFormat("fa-IR", {
                                weekday: "short",
                                timeZone: "Asia/Tehran",
                              }).format(day)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    </div>
                  </section>
                </>
              )}
              {section !== "overview" &&
                section !== "settings" &&
                section !== "service" && (
                  <section className="adm-panel">
                    <div className="adm-toolbar">
                      <div className="adm-search">
                        <Search size={18} />
                        <input
                          aria-label={`جست‌وجو در ${currentTitle}`}
                          placeholder={`جست‌وجو در ${currentTitle}…`}
                          value={query}
                          onChange={(e) => {
                            setQuery(e.target.value);
                            setPage(1);
                          }}
                        />
                      </div>
                      {section === "orders" && (
                        <select
                          aria-label="فیلتر وضعیت سفارش"
                          value={filter}
                          onChange={(e) => {
                            setFilter(e.target.value);
                            setPage(1);
                          }}
                        >
                          <option value="all">همه وضعیت‌ها</option>
                          {Object.entries(statuses).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      )}
                      <span>{toFaDigits(count)} مورد</span>
                    </div>
                    {section === "orders" && (
                      <>
                        {customer && (
                          <Link
                            href="/admin?section=orders"
                            className="adm-text-link"
                          >
                            حذف فیلتر مشتری
                            <X size={15} />
                          </Link>
                        )}
                        {orderTable(filteredOrders)}
                      </>
                    )}
                    {section === "products" && (
                      <div className="adm-table-wrap" role="region" aria-label="جدول اطلاعات مدیریت" tabIndex={0}>
                        <table>
                          <thead>
                            <tr>
                              <th>محصول</th>
                              <th>دسته‌بندی</th>
                              <th>قیمت</th>
                              <th>موجودی</th>
                              <th>نمایش</th>
                              <th>عملیات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {state.products
                              .filter((p) => match(p.name + " " + p.category))
                              .slice((page - 1) * 20, page * 20)
                              .map((p) => (
                                <tr key={p.id}>
                                  <td>
                                    <div className="adm-product-cell">
                                      <img src={p.image_url} alt="" />
                                      <div>
                                        <strong>{p.name}</strong>
                                        <small>
                                          {toFaDigits(p.weight)} {p.weight_unit}
                                        </small>
                                      </div>
                                    </div>
                                  </td>
                                  <td data-label="دسته‌بندی">{p.category}</td>
                                  <td data-label="مبلغ" className="adm-money">
                                    {formatPrice(p.price)}
                                  </td>
                                  <td data-label="موجودی">
                                    <span
                                      className={
                                        p.stock === 0
                                          ? "adm-stock-out"
                                          : p.stock !== null && p.stock <= 5
                                            ? "adm-stock-low"
                                            : ""
                                      }
                                    >
                                      {p.stock === null
                                        ? "تعیین نشده"
                                        : p.stock === 0
                                          ? "ناموجود"
                                          : `${toFaDigits(p.stock)} بسته`}
                                    </span>
                                  </td>
                                  <td>
                                    <span
                                      className={`adm-status ${p.active ? "adm-status-delivered" : "adm-status-cancelled"}`}
                                    >
                                      {p.active ? "فعال" : "غیرفعال"}
                                    </span>
                                  </td>
                                  <td>
                                    <button
                                      className="adm-edit-button"
                                      onClick={() => edit("products", p)}
                                    >
                                      ویرایش
                                      <ChevronLeft size={15} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {section === "customers" && (
                      <div className="adm-table-wrap" role="region" aria-label="جدول اطلاعات مدیریت" tabIndex={0}>
                        <table>
                          <thead>
                            <tr>
                              <th>مشتری</th>
                              <th>شماره موبایل</th>
                              <th>تعداد سفارش</th>
                              <th>مجموع مبلغ سفارش‌ها</th>
                              <th>آخرین سفارش</th>
                              <th>عملیات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customers
                              .filter((c) => match(c.name + " " + c.phone))
                              .slice((page - 1) * 20, page * 20)
                              .map((c) => (
                                <tr key={c.phone}>
                                  <td>
                                    <strong>{c.name}</strong>
                                  </td>
                                  <td data-label="شماره موبایل" dir="ltr">
                                    {c.phone}
                                  </td>
                                  <td data-label="تعداد سفارش">
                                    {toFaDigits(c.count)}
                                  </td>
                                  <td data-label="مجموع مبلغ">
                                    {formatPrice(c.total)}
                                  </td>
                                  <td data-label="آخرین سفارش">
                                    {date(c.last)}
                                  </td>
                                  <td>
                                    <Link
                                      href={`/admin?section=orders&customer=${encodeURIComponent(c.phone)}`}
                                      className="adm-edit-button"
                                    >
                                      سابقه خرید
                                      <ChevronLeft size={15} />
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {customers.length === 0 && (
                          <Empty title="هنوز مشتری ثبت نشده است" />
                        )}
                      </div>
                    )}
                    {section === "coupons" &&
                      (state.coupons.length ? (
                        <div className="adm-table-wrap" role="region" aria-label="جدول اطلاعات مدیریت" tabIndex={0}>
                          <table>
                            <thead>
                              <tr>
                                <th>کد تخفیف</th>
                                <th>تخفیف</th>
                                <th>حداقل خرید</th>
                                <th>استفاده</th>
                                <th>انقضا</th>
                                <th>وضعیت</th>
                                <th>عملیات</th>
                              </tr>
                            </thead>
                            <tbody>
                              {state.coupons
                                .filter((c) => match(c.code))
                                .slice((page - 1) * 20, page * 20)
                                .map((c) => (
                                  <tr key={c.id}>
                                    <td dir="ltr">
                                      <strong>{c.code}</strong>
                                    </td>
                                    <td data-label="تخفیف">
                                      {c.kind === "percent"
                                        ? `${toFaDigits(c.value)}٪`
                                        : formatPrice(c.value)}
                                    </td>
                                    <td data-label="حداقل خرید">
                                      {formatPrice(c.minimum)}
                                    </td>
                                    <td data-label="تعداد استفاده">
                                      {toFaDigits(c.used)} /{" "}
                                      {c.limit
                                        ? toFaDigits(c.limit)
                                        : "بدون سقف"}
                                    </td>
                                    <td data-label="تاریخ انقضا">
                                      {c.expiresAt
                                        ? date(c.expiresAt)
                                        : "بدون انقضا"}
                                    </td>
                                    <td>
                                      {!c.active
                                        ? "غیرفعال"
                                        : c.expiresAt &&
                                            Date.parse(c.expiresAt) <=
                                              Date.now()
                                          ? "منقضی"
                                          : c.limit > 0 && c.used >= c.limit
                                            ? "ظرفیت تکمیل"
                                            : "فعال"}
                                    </td>
                                    <td>
                                      <button
                                        className="adm-edit-button"
                                        onClick={() => edit("coupons", c)}
                                      >
                                        ویرایش
                                        <ChevronLeft size={15} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <Empty title="اولین کد تخفیف را بسازید">
                          <p>
                            کدهای تخفیف را برای خرید از فروشگاه تعریف و مدیریت
                            کنید.
                          </p>
                        </Empty>
                      ))}
                    {section === "articles" &&
                      state.articles !== null &&
                      state.legacyArticlesEnabled !== false && (
                        <div className="adm-toolbar">
                          <p>مقالات قبلی هنوز از مجله فعلی خوانده می‌شوند.</p>
                          <button
                            className="adm-button adm-secondary"
                            disabled={loading}
                            onClick={async () => {
                              setLoading(true);
                              setError("");
                              try {
                                setState(await importArticles());
                                setNotice("مقالات قبلی آماده ویرایش هستند.");
                              } catch (err) {
                                setError(errorText(err));
                              } finally {
                                setLoading(false);
                              }
                            }}
                          >
                            دریافت مقالات قبلی برای ویرایش
                          </button>
                        </div>
                      )}
                    {section === "articles" &&
                      (state.articles === null ? (
                        <Empty title="مقالات فعلی را به پنل بیاورید">
                          <p>
                            برای ویرایش مقالات قبلی، آن‌ها را دریافت کنید.
                            می‌توانید از همین حالا مقاله جدید هم بنویسید.
                          </p>
                          <button
                            className="adm-button"
                            disabled={loading}
                            onClick={async () => {
                              setLoading(true);
                              setError("");
                              try {
                                setState(await importArticles());
                                setNotice("مقالات فعلی به پنل منتقل شدند.");
                              } catch (err) {
                                setError(errorText(err));
                              } finally {
                                setLoading(false);
                              }
                            }}
                          >
                            {loading ? "در حال دریافت…" : "دریافت مقالات فعلی"}
                          </button>
                        </Empty>
                      ) : state.articles.length ? (
                        <div className="adm-content-grid">
                          {state.articles
                            .filter((a) => match(a.title))
                            .slice((page - 1) * 20, page * 20)
                            .map((a) => (
                              <article key={a.id} className="adm-content-card">
                                <img src={a.image_url} alt="" />
                                <div>
                                  <span className="adm-status">
                                    {a.published ? "منتشرشده" : "پیش‌نویس"}
                                  </span>
                                  <h3>{a.title}</h3>
                                  <p>{a.excerpt}</p>
                                  <button
                                    className="adm-edit-button"
                                    onClick={() => edit("articles", a)}
                                  >
                                    ویرایش مقاله
                                    <ChevronLeft size={15} />
                                  </button>
                                </div>
                              </article>
                            ))}
                        </div>
                      ) : (
                        <Empty title="اولین مقاله مجله را بنویسید" />
                      ))}
                    {section === "banners" &&
                      (state.banners.length ? (
                        <div className="adm-content-grid">
                          {state.banners
                            .filter((b) => match(b.title))
                            .slice((page - 1) * 20, page * 20)
                            .map((b) => (
                              <article className="adm-content-card" key={b.id}>
                                <img src={b.image} alt="" />
                                <div>
                                  <span className="adm-status">
                                    {b.active ? "فعال" : "غیرفعال"}
                                  </span>
                                  <h3>{b.title}</h3>
                                  <p>{b.subtitle}</p>
                                  <button
                                    className="adm-edit-button"
                                    onClick={() => edit("banners", b)}
                                  >
                                    ویرایش بنر
                                    <ChevronLeft size={15} />
                                  </button>
                                </div>
                              </article>
                            ))}
                        </div>
                      ) : (
                        <Empty title="بنر دلخواه فروشگاه را اضافه کنید">
                          <p>
                            تا زمان افزودن بنر فعال، اسلایدهای فعلی فروشگاه
                            نمایش داده می‌شوند.
                          </p>
                        </Empty>
                      ))}
                    {count > 20 && (
                      <div className="adm-pagination">
                        <button
                          className="adm-icon"
                          disabled={page === 1}
                          onClick={() => setPage((p) => p - 1)}
                          aria-label="صفحه قبل"
                        >
                          <ChevronRight size={18} />
                        </button>
                        <span>
                          صفحه {toFaDigits(page)} از{" "}
                          {toFaDigits(Math.ceil(count / 20))}
                        </span>
                        <button
                          className="adm-icon"
                          disabled={page >= Math.ceil(count / 20)}
                          onClick={() => setPage((p) => p + 1)}
                          aria-label="صفحه بعد"
                        >
                          <ChevronLeft size={18} />
                        </button>
                      </div>
                    )}
                  </section>
                )}
              {section === "settings" && (
                <section className="adm-panel adm-settings-summary">
                  <div>
                    <Settings size={25} />
                    <h2>تنظیمات فروشگاه</h2>
                    <p>
                      راه‌های ارتباطی و هزینه ارسال را در فروشگاه به‌روز کنید.
                    </p>
                    <button
                      className="adm-button"
                      onClick={() => edit("settings", state.settings)}
                    >
                      ویرایش تنظیمات
                    </button>
                  </div>
                  <dl>
                    <div>
                      <dt>تلفن</dt>
                      <dd>{state.settings.phone || "وارد نشده"}</dd>
                    </div>
                    <div>
                      <dt>ایمیل</dt>
                      <dd>{state.settings.email || "وارد نشده"}</dd>
                    </div>
                    <div>
                      <dt>نشانی</dt>
                      <dd>{state.settings.address || "وارد نشده"}</dd>
                    </div>
                    <div>
                      <dt>هزینه ارسال</dt>
                      <dd>
                        {state.settings.shippingEnabled
                          ? formatPrice(state.settings.shippingFee)
                          : "هنوز تعیین نشده"}
                      </dd>
                    </div>
                    <div>
                      <dt>ارسال رایگان</dt>
                      <dd>
                        {state.settings.freeShippingAbove
                          ? `از ${formatPrice(state.settings.freeShippingAbove)}`
                          : "غیرفعال"}
                      </dd>
                    </div>
                  </dl>
                </section>
              )}
            </>
          )}
          {section === "settings" && authenticated && <AdminSecurity onEnded={() => { setAuthenticated(false); setState(null); setOrders([]); }} />}
          <div className="adm-page-footer">
            <span>ورسا؛ دلگشای سفره‌های اصیل</span>
            <span>
              {updated
                ? `آخرین دریافت: ${new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" }).format(updated)}`
                : ""}
            </span>
          </div>
        </main>
      </div>
      {editor && (
        <Editor
          {...editor}
          onClose={() => setEditor(null)}
          onUnauthorized={logout}
          onSave={(s) => {
            setState(s);
            setEditor(null);
            setNotice("تغییرات ذخیره شد و در فروشگاه اعمال می‌شود.");
          }}
        />
      )}
      {selected && (
        <OrderDetail
          key={selected.id}
          order={selected}
          onClose={() => setSelected(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

