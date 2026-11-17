import { customFetch } from "@workspace/api-client-react";

export type CardTransferConfig =
  | { enabled: false }
  | {
      enabled: true;
      cardNumber: string;
      accountName: string;
      bankName: string;
    };
export interface PaymentView {
  order: { id: string; orderNumber: string; total: number; status: string };
  paymentStatus: string;
  shippingConfigured: boolean;
  config: CardTransferConfig;
  receipt: null | {
    id: string;
    status: string;
    createdAt: string;
    deliveryStatus: string;
  };
}
export function rememberPayment(id: string, key: string) {
  try {
    sessionStorage.setItem(`varsa-payment:${id}`, key);
  } catch {
    /* Checkout retains its key in memory. */
  }
}
export function paymentKey(id: string) {
  try {
    return sessionStorage.getItem(`varsa-payment:${id}`) ?? undefined;
  } catch {
    return undefined;
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
