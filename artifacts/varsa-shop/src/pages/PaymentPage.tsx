import { Link } from "wouter";
import { CardTransferPayment } from "@/components/CardTransferPayment";
export function PaymentPage({ id }: { id: string }) {
  return (
    <main
      dir="rtl"
      className="container-luxe min-h-screen pb-20 pt-28 text-cream-200 sm:pt-32"
    >
      <div className="mx-auto max-w-5xl">
        <div className="max-w-xl">
          <h1
            tabIndex={-1}
            ref={(heading) => heading?.focus({ preventScroll: true })}
            className="mb-6 font-display text-2xl font-bold"
          >
            پرداخت و پیگیری رسید
          </h1>
          <CardTransferPayment orderId={id} />
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/account?view=orders&track=1" className="btn-gold">
              پیگیری سفارش در حساب
            </Link>
            <Link href="/shop" className="btn-ghost">
              ادامه خرید
            </Link>
          </div>
          <p className="mt-4 text-xs leading-6 text-cream-400">
            با شمارهٔ سفارش و تأیید موبایل خرید، از مرورگر دیگری هم می‌توانید
            سفارش را پیگیری کنید.
          </p>
        </div>
      </div>
    </main>
  );
}
