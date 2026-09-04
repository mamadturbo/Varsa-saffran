import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  LogOut,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react';
import type { Order, OrderStatus } from '@workspace/api-client-react';
import {
  changeAdminOrderStatus,
  clearAdminToken,
  fetchAdminOrders,
  getAdminToken,
  getApiErrorMessage,
  saveAdminToken,
  signInAdmin,
} from '@/lib/orders-api';
import { formatPrice, toFaDigits } from '@/lib/site';

const STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'pending', label: 'در انتظار بررسی' },
  { value: 'confirmed', label: 'تأیید شده' },
  { value: 'processing', label: 'در حال آماده‌سازی' },
  { value: 'shipped', label: 'ارسال شده' },
  { value: 'delivered', label: 'تحویل شده' },
  { value: 'cancelled', label: 'لغو شده' },
];

const STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'در انتظار بررسی', className: 'border-gold-500/30 bg-gold-500/10 text-gold-700 dark:text-gold-200' },
  confirmed: { label: 'تأیید شده', className: 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-200' },
  processing: { label: 'در حال آماده‌سازی', className: 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-200' },
  shipped: { label: 'ارسال شده', className: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200' },
  delivered: { label: 'تحویل شده', className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200' },
  cancelled: { label: 'لغو شده', className: 'border-crimson-500/25 bg-crimson-500/10 text-crimson-700 dark:text-crimson-200' },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function AdminLogin({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const token = await signInAdmin(password);
      saveAdminToken(token);
      onSuccess(token);
    } catch (loginError) {
      setError(getApiErrorMessage(loginError, 'رمز مدیر نادرست است.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-gold-500/25 bg-gold-500/10 text-gold-600 dark:text-gold-300">
            <ShieldCheck className="h-8 w-8" strokeWidth={1.4} />
          </div>
          <p className="text-sm tracking-[0.25em] text-gold-600 dark:text-gold-300">VARSA ADMIN</p>
          <h1 className="mt-3 font-display text-3xl font-bold text-cream-50">مرکز مدیریت سفارش‌ها</h1>
          <p className="mt-3 text-sm leading-7 text-cream-400">برای مشاهده و پیگیری سفارش‌های ورسا وارد شوید.</p>
        </div>

        <form onSubmit={handleSubmit} className="card-luxe p-7">
          <input
            type="text"
            name="username"
            autoComplete="username"
            value="admin"
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
          />
          <label htmlFor="admin-password" className="mb-2 block text-sm font-medium text-gold-700 dark:text-gold-200">رمز ورود مدیر</label>
          <input
            id="admin-password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input-luxe"
            placeholder="رمز مدیر را وارد کنید"
          />
          {error && (
            <p className="mt-3 rounded-xl border border-crimson-500/25 bg-crimson-500/10 px-4 py-3 text-sm leading-6 text-crimson-700 dark:text-crimson-300">
              {error}
            </p>
          )}
          <button type="submit" disabled={submitting} className="btn-solid mt-6 w-full disabled:cursor-wait disabled:opacity-60">
            {submitting ? 'در حال بررسی...' : 'ورود به پنل'}
            <ArrowRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => { window.location.href = '/'; }} className="btn-ghost mt-3 w-full">
            بازگشت به فروشگاه
          </button>
        </form>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof PackageCheck;
  accent: string;
}) {
  return (
    <div className="card-luxe flex items-center justify-between p-5">
      <div>
        <p className="text-sm text-cream-400">{label}</p>
        <p className="mt-2 text-2xl font-bold text-cream-50">{value}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accent}`}>
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>
    </div>
  );
}

function OrderDetails({
  order,
  onClose,
  onStatusChange,
}: {
  order: Order;
  onClose: () => void;
  onStatusChange: (status: OrderStatus) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const handleStatusChange = async (status: OrderStatus) => {
    setSaving(true);
    try {
      await onStatusChange(status);
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="card-luxe h-fit overflow-hidden lg:sticky lg:top-28">
      <div className="flex items-start justify-between border-b border-gold-500/15 p-5">
        <div>
          <p className="text-xs tracking-widest text-gold-600 dark:text-gold-300">جزئیات سفارش</p>
          <h2 className="mt-2 text-xl font-bold text-cream-50">{order.orderNumber}</h2>
        </div>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-500/20 text-cream-400 hover:bg-gold-500/10 hover:text-cream-50" aria-label="بستن جزئیات">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-tint-soft-3 p-3">
            <p className="text-xs text-cream-400">مشتری</p>
            <p className="mt-1 text-sm font-medium text-cream-100">{order.customerName}</p>
          </div>
          <div className="rounded-xl bg-surface-tint-soft-3 p-3">
            <p className="text-xs text-cream-400">تماس</p>
            <p dir="ltr" className="mt-1 text-left text-sm font-medium text-cream-100">{order.phone}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-cream-400">نشانی ارسال</p>
          <p className="mt-2 text-sm leading-7 text-cream-200">{order.address}</p>
        </div>
        <div>
          <p className="mb-2 text-xs text-cream-400">وضعیت سفارش</p>
          <div className="relative">
            <select
              value={order.status}
              disabled={saving}
              onChange={(event) => void handleStatusChange(event.target.value as OrderStatus)}
              className="input-luxe appearance-none pl-10"
            >
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-500" />
          </div>
        </div>
        <div className="border-t border-gold-500/15 pt-4">
          <p className="mb-3 text-xs text-cream-400">اقلام سفارش</p>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={`${order.id}-${item.productId}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-cream-200">{item.name} <span className="text-cream-400">×{toFaDigits(item.quantity)}</span></span>
                <span className="whitespace-nowrap font-medium text-gold-600 dark:text-gold-200">{formatPrice(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-gold-500/15 pt-3">
            <span className="text-sm text-cream-300">مجموع</span>
            <span className="text-lg font-bold text-gold-600 dark:text-gold-200">{formatPrice(order.total)}</span>
          </div>
        </div>
        <p className="text-xs text-cream-500">ثبت شده در {formatDate(order.createdAt)}</p>
      </div>
    </aside>
  );
}

function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const nextOrders = await fetchAdminOrders(statusFilter === 'all' ? undefined : statusFilter);
      setOrders(nextOrders);
      setError('');
    } catch (loadError) {
      if (String(loadError).includes('401')) {
        onLogout();
        return;
      }
      setError(getApiErrorMessage(loadError, 'دریافت سفارش‌ها انجام نشد.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onLogout, statusFilter]);

  useEffect(() => {
    void loadOrders();
    const interval = window.setInterval(() => void loadOrders(), 30000);
    return () => window.clearInterval(interval);
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('fa');
    if (!normalized) return orders;
    return orders.filter((order) =>
      [order.orderNumber, order.customerName, order.phone].some((value) =>
        value.toLocaleLowerCase('fa').includes(normalized),
      ),
    );
  }, [orders, search]);

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? null;
  const totalSales = orders
    .filter((order) => order.status !== 'cancelled')
    .reduce((sum, order) => sum + order.total, 0);
  const pendingCount = orders.filter((order) => order.status === 'pending').length;
  const activeCount = orders.filter((order) => ['confirmed', 'processing', 'shipped'].includes(order.status)).length;

  const updateStatus = async (status: OrderStatus) => {
    if (!selectedOrder) return;
    try {
      const updated = await changeAdminOrderStatus(selectedOrder.id, status);
      setOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
    } catch (updateError) {
      setError(getApiErrorMessage(updateError, 'تغییر وضعیت انجام نشد.'));
    }
  };

  return (
    <main className="min-h-screen bg-ink-900 pb-16">
      <header className="border-b border-gold-500/15 bg-ink-900/90 backdrop-blur-xl">
        <div className="container-luxe flex min-h-20 items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.25em] text-gold-600 dark:text-gold-300">VARSA ADMIN</p>
            <h1 className="mt-1 text-xl font-bold text-cream-50">مدیریت سفارش‌ها</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void loadOrders(true)} disabled={refreshing} className="btn-ghost px-4 py-2 text-xs">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              به‌روزرسانی
            </button>
            <button onClick={onLogout} className="flex h-10 items-center gap-2 rounded-full border border-gold-500/20 px-4 text-sm text-cream-300 hover:bg-gold-500/10 hover:text-cream-50">
              <LogOut className="h-4 w-4" />
              خروج
            </button>
          </div>
        </div>
      </header>

      <div className="container-luxe pt-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="کل سفارش‌ها" value={toFaDigits(orders.length)} icon={PackageCheck} accent="bg-gold-500/10 text-gold-600 dark:text-gold-300" />
          <MetricCard label="نیازمند بررسی" value={toFaDigits(pendingCount)} icon={Clock3} accent="bg-amber-500/10 text-amber-700 dark:text-amber-300" />
          <MetricCard label="در جریان ارسال" value={toFaDigits(activeCount)} icon={Truck} accent="bg-cyan-500/10 text-cyan-700 dark:text-cyan-300" />
          <MetricCard label="فروش ثبت‌شده" value={formatPrice(totalSales)} icon={Check} accent="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" />
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-crimson-500/25 bg-crimson-500/10 px-5 py-4 text-sm text-crimson-700 dark:text-crimson-300">
            {error}
          </div>
        )}

        <div className={`mt-8 grid gap-6 ${selectedOrder ? 'lg:grid-cols-[minmax(0,1fr)_380px]' : ''}`}>
          <section className="card-luxe overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-gold-500/15 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-cream-50">سفارش‌های اخیر</h2>
                <p className="mt-1 text-sm text-cream-400">صد سفارش آخر از جدیدترین به قدیمی‌ترین</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream-500" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} className="input-luxe py-2 pr-10 text-sm sm:w-52" placeholder="جست‌وجوی مشتری..." />
                </div>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | OrderStatus)} className="input-luxe py-2 text-sm sm:w-44">
                  <option value="all">همه وضعیت‌ها</option>
                  {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-64 items-center justify-center text-sm text-cream-400">در حال دریافت سفارش‌ها...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <PackageCheck className="h-10 w-10 text-gold-500/60" strokeWidth={1.2} />
                <p className="mt-4 text-cream-300">سفارشی با این فیلتر پیدا نشد.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-right text-sm">
                  <thead className="bg-surface-tint-soft-3 text-xs text-cream-400">
                    <tr>
                      <th className="px-5 py-3 font-medium">کد سفارش</th>
                      <th className="px-5 py-3 font-medium">مشتری</th>
                      <th className="px-5 py-3 font-medium">مبلغ</th>
                      <th className="px-5 py-3 font-medium">تاریخ</th>
                      <th className="px-5 py-3 font-medium">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gold-500/10">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} onClick={() => setSelectedOrderId(order.id)} className={`cursor-pointer transition-colors hover:bg-gold-500/5 ${selectedOrderId === order.id ? 'bg-gold-500/8' : ''}`}>
                        <td className="px-5 py-4 font-medium text-gold-700 dark:text-gold-200">{order.orderNumber}</td>
                        <td className="px-5 py-4">
                          <p className="font-medium text-cream-100">{order.customerName}</p>
                          <p dir="ltr" className="mt-1 text-left text-xs text-cream-500">{order.phone}</p>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-cream-200">{formatPrice(order.total)}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-xs text-cream-400">{formatDate(order.createdAt)}</td>
                        <td className="px-5 py-4"><StatusBadge status={order.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {selectedOrder && (
            <OrderDetails
              order={selectedOrder}
              onClose={() => setSelectedOrderId(null)}
              onStatusChange={updateStatus}
            />
          )}
        </div>
      </div>
    </main>
  );
}

export function AdminPage() {
  const [token, setToken] = useState<string | null>(() => getAdminToken());

  const logout = useCallback(() => {
    clearAdminToken();
    setToken(null);
  }, []);

  if (!token) return <AdminLogin onSuccess={setToken} />;
  return <AdminDashboard token={token} onLogout={logout} />;
}