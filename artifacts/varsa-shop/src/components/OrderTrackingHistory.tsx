import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import {
  readOrderTracking,
  type OrderTracking,
  type Shipment,
} from "@/lib/management-api";
import { getApiErrorMessage } from "@/lib/orders-api";

const dateTime = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tehran",
});
const statuses: Record<string, string> = {
  pending: "در انتظار بررسی",
  confirmed: "سفارش تأیید شد",
  processing: "آماده‌سازی آغاز شد",
  shipped: "مرسوله ارسال شد",
  delivered: "مرسوله تحویل شد",
  cancelled: "سفارش لغو شد",
};
const payments = {
  unpaid: "پرداخت تأیید نشده",
  paid: "پرداخت تأیید شده",
  refunded: "وجه بازگردانده شده",
};
const receipts = {
  pending: "رسید در انتظار بررسی",
  approved: "رسید پذیرفته شده",
  rejected: "رسید رد شده",
};

function eventLabel(event: OrderTracking["events"][number]) {
  switch (event.kind) {
    case "order_created":
      return "سفارش ثبت شد";
    case "status_changed":
      return statuses[event.value ?? ""] ?? "وضعیت سفارش تغییر کرد";
    case "receipt_submitted":
      return "رسید پرداخت ثبت شد";
    case "receipt_reviewed":
      return event.value === "approved" ? "واریز تأیید شد" : "رسید رد شد";
    case "shipment_updated":
      return "اطلاعات رهگیری به‌روز شد";
  }
}

function actorLabel(actor: string) {
  if (actor.startsWith("admin:")) return "مدیر فروشگاه";
  if (actor.startsWith("bale:")) return "بررسی در بله";
  if (actor.startsWith("customer:")) return "خریدار";
  return "سیستم";
}

function ShipmentDetails({ shipment }: { shipment: Shipment }) {
  return (
    <dl className="min-w-0 space-y-1 break-words">
      {shipment.carrier && (
        <div>
          <dt className="inline">شرکت حمل </dt>
          <dd className="inline font-semibold">{shipment.carrier}</dd>
        </div>
      )}
      {shipment.trackingCode && (
        <div>
          <dt className="inline">کد رهگیری </dt>
          <dd className="inline font-semibold">
            <bdi className="break-all">{shipment.trackingCode}</bdi>
          </dd>
        </div>
      )}
      {shipment.shippedAt && (
        <div>
          <dt className="inline">ارسال </dt>
          <dd className="inline">
            <time dateTime={shipment.shippedAt}>
              {dateTime.format(new Date(shipment.shippedAt))}
            </time>
          </dd>
        </div>
      )}
      {shipment.deliveredAt && (
        <div>
          <dt className="inline">تحویل </dt>
          <dd className="inline">
            <time dateTime={shipment.deliveredAt}>
              {dateTime.format(new Date(shipment.deliveredAt))}
            </time>
          </dd>
        </div>
      )}
    </dl>
  );
}

export function OrderTrackingHistory({
  orderId,
  admin = false,
}: {
  orderId: string;
  admin?: boolean;
}) {
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const request = new AbortController();
    setTracking(null);
    setError("");
    readOrderTracking(orderId, admin, request.signal)
      .then((row) => {
        if (!request.signal.aborted) setTracking(row);
      })
      .catch((reason) => {
        if (!request.signal.aborted)
          setError(
            getApiErrorMessage(reason, "دریافت تاریخچهٔ سفارش انجام نشد."),
          );
      });
    return () => request.abort();
  }, [orderId, admin, attempt]);

  return (
    <section
      className="my-3 space-y-3 text-sm leading-relaxed"
      aria-label="تاریخچهٔ سفارش"
    >
      <h3 className="font-semibold">تاریخچهٔ سفارش</h3>
      {error ? (
        <div>
          <p role="alert">{error}</p>
          <button
            type="button"
            className="min-h-11 underline"
            onClick={() => setAttempt((i) => i + 1)}
          >
            تلاش مجدد
          </button>
        </div>
      ) : !tracking ? (
        <p role="status">در حال دریافت تاریخچه…</p>
      ) : (
        <>
          <dl className="space-y-1">
            <div>
              <dt className="inline">وضعیت فعلی </dt>
              <dd className="inline font-semibold">
                {statuses[tracking.status] ?? tracking.status}
              </dd>
            </div>
            <div>
              <dt className="inline">پرداخت </dt>
              <dd className="inline">{payments[tracking.paymentStatus]}</dd>
            </div>
            {tracking.receiptStatus && (
              <div>
                <dt className="inline">آخرین رسید </dt>
                <dd className="inline">{receipts[tracking.receiptStatus]}</dd>
              </div>
            )}
          </dl>
          {tracking.shipment &&
            Object.values(tracking.shipment).some(Boolean) && (
              <div className="flex items-start gap-2">
                <Truck size={18} aria-hidden="true" />
                <ShipmentDetails shipment={tracking.shipment} />
              </div>
            )}
          {tracking.events.length > 0 && (
            <ol className="space-y-2 border-s border-current/20 ps-3">
              {tracking.events.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-3"
                >
                  <span>
                    {eventLabel(event)}
                    {event.actor && (
                      <small className="ms-2">
                        · {actorLabel(event.actor)}
                      </small>
                    )}
                  </span>
                  <time dateTime={event.occurredAt} className="text-xs">
                    {dateTime.format(new Date(event.occurredAt))}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
