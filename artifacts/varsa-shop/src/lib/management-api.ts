import { customFetch } from "@workspace/api-client-react";
import type {
  ManagementState,
  Banner,
  StoreSettings,
  ManagedArticle,
  OrderPricing,
} from "@workspace/catalog";
import type { Order } from "@workspace/api-client-react";
import type { OrderMeta } from "@workspace/catalog";
export type PaymentStatus = "unpaid" | "paid" | "refunded";
export type Shipment = {
  carrier: string | null;
  trackingCode: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
};
export type OrderTracking = {
  status: Order["status"];
  paymentStatus: PaymentStatus;
  fulfillmentStatus: string;
  receiptStatus: "pending" | "approved" | "rejected" | null;
  shipment: Shipment | null;
  events: Array<{
    id: number;
    kind: "order_created" | "status_changed" | "receipt_submitted" | "receipt_reviewed" | "shipment_updated";
    value: string | null;
    occurredAt: string;
    actor?: string;
  }>;
};
export type AdminOrder = Order & {
  management: OrderMeta | null;
  shipment?: Shipment | null;
  paymentStatus?: PaymentStatus;
  customerContactId?: string | null;
};

export async function readAdminOrder(id: string) {
  return (await customFetch<{ order: AdminOrder }>(`/api/admin/orders/${encodeURIComponent(id)}`, {
    signal: AbortSignal.timeout(20000),
  })).order;
}

export function readOrderTracking(id: string, admin: boolean, signal: AbortSignal) {
  const scope = admin ? "admin" : "customer";
  return customFetch<OrderTracking>(`/api/${scope}/orders/${encodeURIComponent(id)}/tracking`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  });
}
export type StoreContent = {
  banners: Banner[];
  settings: StoreSettings;
  articles: ManagedArticle[] | null;
  useLegacyArticles?: boolean;
};
export const readManagement = () =>
  customFetch<ManagementState>("/api/admin/management", {
    signal: AbortSignal.timeout(20000),
  });
export const readOrders = async () =>
  (
    await customFetch<{ orders: AdminOrder[] }>("/api/admin/orders", {
      signal: AbortSignal.timeout(20000),
    })
  ).orders;
export const saveManagement = (
  collection: string,
  id: string,
  item: unknown,
  revision: number,
) =>
  customFetch<ManagementState>(
    `/api/admin/management/${collection}/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item, revision }),
      signal: AbortSignal.timeout(20000),
    },
  );
export const readStoreContent = () =>
  customFetch<StoreContent>("/api/store/content", {
    signal: AbortSignal.timeout(20000),
  });
export const quoteOrder = (
  items: Array<{ productId: string; quantity: number }>,
  couponCode: string,
) =>
  customFetch<OrderPricing>("/api/store/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, couponCode }),
    signal: AbortSignal.timeout(20000),
  });
export const importArticles = () =>
  customFetch<ManagementState>("/api/admin/management/import-articles", {
    method: "POST",
    signal: AbortSignal.timeout(60000),
  });
export const saveFulfillment = async (
  id: string,
  status: string,
  trackingCode: string,
  carrier?: string,
) =>
  (
    await customFetch<{ order: AdminOrder }>(`/api/admin/orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, trackingCode, carrier }),
      signal: AbortSignal.timeout(20000),
    })
  ).order;
export async function uploadImage(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 4 * 1024 * 1024
  )
    throw new Error("تصویر PNG، JPG یا WebP تا ۴ مگابایت انتخاب کنید.");
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  return (
    await customFetch<{ url: string }>("/api/admin/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mime: file.type, data }),
      signal: AbortSignal.timeout(30000),
    })
  ).url;
}
