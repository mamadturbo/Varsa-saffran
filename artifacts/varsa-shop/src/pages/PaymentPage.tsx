import { Link } from "wouter";
import { CardTransferPayment } from "@/components/CardTransferPayment";
export function PaymentPage({ id }: { id: string }) {
  return (
    <main
      dir="rtl"
      className="mx-auto min-h-screen max-w-xl px-4 pb-20 pt-32 text-cream-200"
    >
      <h1 className="mb-6 font-display text-2xl font-bold">
        پرداخت و پیگیری رسید
      </h1>
      <CardTransferPayment orderId={id} />
      <Link href="/account?view=orders" className="btn-gold mt-8">
        سفارش‌های من
      </Link>
      <p className="mt-4 text-xs leading-6 text-cream-400">
        برای پیگیری سفارش مهمان، همین صفحه را در همین مرورگر و برگه نگه دارید.
      </p>
    </main>
  );
}
