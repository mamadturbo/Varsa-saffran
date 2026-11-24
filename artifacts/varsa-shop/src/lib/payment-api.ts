import { customFetch, type CreateOrderResponse, type OrderStatus } from "@workspace/api-client-react";

export type CardTransferConfig =
  | { enabled: false }
  | {
      enabled: true;
      cardNumber: string;
      accountName: string;
      bankName: string;
    };
export interface PaymentView {
  order: { id: string; orderNumber: string; total: number; status: OrderStatus };
  paymentStatus: string;
  shippingConfigured: boolean;
  canSubmitReceipt?: boolean;
  config: CardTransferConfig;
  receipt: null | {
    id: string;
    status: string;
    createdAt: string;
    deliveryStatus: string;
  };
}
const recentPayments = new Map<string, { key: string; receipt: CreateOrderResponse }>();

export function rememberPayment(receipt: CreateOrderResponse, key: string) {
  recentPayments.set(receipt.id, { key, receipt });
  try {
    sessionStorage.setItem(`varsa-payment:${receipt.id}`, key);
  } catch {
    /* Payment can still use the key for this visit. */
  }
}
export function rememberedOrder(id: string) {
  return recentPayments.get(id)?.receipt;
}
export function paymentKey(id: string) {
  const key = recentPayments.get(id)?.key;
  try {
    return key ?? sessionStorage.getItem(`varsa-payment:${id}`) ?? undefined;
  } catch {
    return key;
  }
}
export function paymentRequest<T>(
  id: string,
  key?: string,
  action = "",
  body?: unknown,
) {
  return customFetch<T>(
    `/api/orders/${encodeURIComponent(id)}/payment${action}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { "X-Order-Key": key } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30000),
    },
  );
}
export async function receiptData(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 4 * 1024 * 1024 ||
    !file.size
  )
    throw new Error(
      "عکس رسید را با فرمت JPG، PNG یا WebP و حجم حداکثر ۴ مگابایت انتخاب کنید.",
    );
  return new Promise<{ data: string; mime: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ data: String(reader.result).split(",")[1], mime: file.type });
    reader.onerror = () => reject(new Error("خواندن عکس رسید انجام نشد."));
    reader.readAsDataURL(file);
  });
}
