import { z } from 'zod';
import type { CreateOrderResponse, OrderStatus } from '@workspace/api-client-react';

export const ORDER_RECEIPT_STATUS = {
  pending: { label: 'در انتظار بررسی', title: 'درخواست سفارش ثبت شد', message: 'درخواست شما ذخیره شده و در انتظار بررسی است.' },
  confirmed: { label: 'تأیید شده', title: 'سفارش تأیید شده است', message: 'سفارش شما تأیید شده است. وضعیت ارسال را جداگانه پیگیری کنید.' },
  processing: { label: 'در حال آماده‌سازی', title: 'سفارش در حال آماده‌سازی است', message: 'سفارش شما برای ارسال آماده می‌شود.' },
  shipped: { label: 'ارسال شده', title: 'سفارش ارسال شده است', message: 'وضعیت این سفارش به ارسال‌شده تغییر کرده است.' },
  delivered: { label: 'تحویل شده', title: 'سفارش تحویل شده است', message: 'وضعیت این سفارش به تحویل‌شده تغییر کرده است.' },
  cancelled: { label: 'لغو شده', title: 'سفارش لغو شده است', message: 'این سفارش در وضعیت لغوشده قرار دارد.' },
} satisfies Record<OrderStatus, { label: string; title: string; message: string }>;

export const UNCONFIRMED_ORDER_MESSAGE = 'پاسخ ثبت سفارش قابل تأیید نیست. سبد شما حفظ شده است؛ با همین سبد و اطلاعات دوباره تلاش کنید.';
export const UNCERTAIN_ORDER_MESSAGE = 'پاسخ قطعی ثبت سفارش دریافت نشد. سبد شما حفظ شده است؛ با همین سبد و اطلاعات دوباره تلاش کنید.';

const receiptSchema = z.object({
  id: z.string().trim().min(1).max(100),
  orderNumber: z.string().trim().min(1).max(64),
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
  total: z.number().int().min(0).max(2_147_483_647),
  createdAt: z.string().datetime({ offset: true }),
});

export function parseOrderReceipt(value: unknown): CreateOrderResponse {
  const parsed = receiptSchema.safeParse(value);
  if (!parsed.success) throw new Error(UNCONFIRMED_ORDER_MESSAGE);
  return parsed.data;
}

export function getOrderSubmitErrorMessage(error: unknown): string {
  const response = error && typeof error === 'object' ? error as { status?: unknown; data?: unknown } : null;
  // A failed HTTP response or lost acknowledgement does not prove that the
  // transaction failed. Preserve the cart/key and describe the uncertainty.
  if (response && typeof response.status === 'number') {
    if (response.status >= 400 && response.status < 500) {
      const data = response.data;
      if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string' && data.message.trim()) return data.message;
      return 'اطلاعات سفارش پذیرفته نشد. لطفاً اطلاعات و سبد خرید را بررسی کنید.';
    }
    return UNCERTAIN_ORDER_MESSAGE;
  }
  if (error instanceof TypeError || (error instanceof Error && ['AbortError', 'TimeoutError', 'ResponseParseError'].includes(error.name))) return UNCERTAIN_ORDER_MESSAGE;
  return error instanceof Error && error.message ? error.message : UNCERTAIN_ORDER_MESSAGE;
}
