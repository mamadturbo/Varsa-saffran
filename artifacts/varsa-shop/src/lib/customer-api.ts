import { customFetch } from "@workspace/api-client-react";
import type {
  Customer,
  CustomerCase,
  CustomerNotification,
  ProductReview,
  CustomerAddress,
} from "@workspace/catalog";
import type { AdminOrder } from "./management-api";
export type CustomerOrder = AdminOrder & { paymentStatus: "unpaid" | "paid" | "refunded" };
export interface CustomerDashboard {
  customer: Customer;
  orders: CustomerOrder[];
  cases: CustomerCase[];
  notifications: CustomerNotification[];
  reviews: ProductReview[];
  returnWindowDays: number;
}
export interface CustomerServiceData {
  cases: CustomerCase[];
  reviews: ProductReview[];
  notifications: CustomerNotification[];
  customers: Customer[];
}
export function customerRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
) {
  return customFetch<T>(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
}
export const getCustomer = () =>
  customerRequest<{ customer: Customer | null }>("/customer/me");
export const getDashboard = () =>
  customerRequest<CustomerDashboard>("/customer/dashboard");
export const getCustomerService = () =>
  customerRequest<CustomerServiceData>("/admin/customer-service");
export const putAddress = (a: CustomerAddress) =>
  customerRequest<{ customer: Customer }>(
    `/customer/addresses/${encodeURIComponent(a.id)}`,
    "PUT",
    a,
  );
export async function uploadCustomerImage(file: File, customerId?: string) {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 4 * 1024 * 1024
  )
    throw new Error("تصویر PNG، JPG یا WebP تا ۴ مگابایت انتخاب کنید.");
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(new Error("خواندن تصویر انجام نشد."));
    r.readAsDataURL(file);
  });
  return (
    await customerRequest<{ url: string }>("/customer/media", "POST", {
      mime: file.type,
      data,
      customerId,
    })
  ).url;
}
