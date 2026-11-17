import { useEffect, useState } from "react";
import { Heart, Upload, X, Star } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { useCustomer } from "@/lib/customer";
import { customerRequest, uploadCustomerImage } from "@/lib/customer-api";
import { toFaDigits } from "@/lib/site";
export function FavoriteButton({ productId }: { productId: string }) {
  const { favoriteIds, toggleFavorite, favoriteBusy, ready } = useCustomer();
  const [error, setError] = useState("");
  const saved = favoriteIds.includes(productId);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        disabled={favoriteBusy || !ready}
        aria-pressed={saved}
        aria-label={saved ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
        onClick={async () => {
          setError("");
          try {
            await toggleFavorite(productId);
          } catch (e) {
            setError(e instanceof Error ? e.message : "ذخیره انجام نشد.");
          }
        }}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold-500/25 text-accent"
      >
        <Heart size={19} fill={saved ? "currentColor" : "none"} />
      </button>
      {error && (
        <span
          role="alert"
          className="absolute left-0 top-full z-20 w-52 rounded-lg bg-ink-800 p-3 text-xs text-cream-50"
        >
          {error}
        </span>
      )}
    </span>
  );
}
export function PrivateImage({ src }: { src: string }) {
  const [url, setUrl] = useState(""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true,
      object = "";
    setFailed(false);
    customFetch<Blob>(src, {
      responseType: "blob",
      signal: AbortSignal.timeout(20000),
    })
      .then((blob) => {
        object = URL.createObjectURL(blob);
        if (active) setUrl(object);
        else URL.revokeObjectURL(object);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (object) URL.revokeObjectURL(object);
    };
  }, [src]);
  return failed ? (
    <span className="vc-hint">تصویر در دسترس نیست.</span>
  ) : url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="مشاهده تصویر پیوست"
    >
      <img className="vc-attachment" src={url} alt="تصویر پیوست درخواست" />
    </a>
  ) : (
    <span className="vc-hint">دریافت تصویر…</span>
  );
}
export function AttachmentPicker({
  images,
  onChange,
  customerId,
  onBusy,
}: {
  images: string[];
  onChange: (v: string[]) => void;
  customerId?: string;
  onBusy?: (v: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="vc-attachments">
      <div>
        {images.map((src) => (
          <div className="vc-attachment-item" key={src}>
            <PrivateImage src={src} />
            <button
              type="button"
              aria-label="حذف تصویر پیوست"
              onClick={() => onChange(images.filter((v) => v !== src))}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      {images.length < 3 && (
        <label className="vc-upload">
          <Upload size={16} />
          {busy ? "در حال بارگذاری…" : "پیوست تصویر"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              onBusy?.(true);
              setError("");
              try {
                onChange([...images, await uploadCustomerImage(f, customerId)]);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "بارگذاری انجام نشد.",
                );
              } finally {
                setBusy(false);
                onBusy?.(false);
              }
            }}
          />
        </label>
      )}
      <small>حداکثر ۳ تصویر، هرکدام تا ۴ مگابایت</small>
      {error && (
        <p role="alert" className="vc-error">
          {error}
        </p>
      )}
    </div>
  );
}
export function ProductReviews({ productId }: { productId: string }) {
  const [data, setData] = useState<{
      reviews: Array<{
        id: string;
        rating: number;
        body: string;
        author: string;
      }>;
      average: number | null;
      count: number;
    } | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    customerRequest<typeof data>(
      `/store/reviews/${encodeURIComponent(productId)}`,
    )
      .then((r) => {
        if (active) setData(r);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [productId]);
  return (
    <section className="mt-6 border-t border-gold-500/20 pt-5">
      <h3 className="text-sm font-semibold text-cream-50">تجربه خریداران</h3>
      {error ? (
        <p className="mt-2 text-xs text-cream-400">دریافت نظرها انجام نشد.</p>
      ) : !data ? (
        <p className="mt-2 text-xs text-cream-400">در حال دریافت نظرها…</p>
      ) : data.count ? (
        <>
          <p className="mt-2 flex items-center gap-2 text-sm text-accent">
            <Star size={15} />
            {toFaDigits(data.average!.toFixed(1))} از ۵ ·{" "}
            {toFaDigits(data.count)} نظر خریدار
          </p>
          {data.reviews.map((r) => (
            <div
              key={r.id}
              className="mt-4 rounded-xl border border-gold-500/15 p-3 text-sm text-cream-200"
            >
              <div className="flex justify-between text-xs text-accent">
                <span>{r.author} · خریدار محصول</span>
                <span>{toFaDigits(r.rating)} از ۵</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap leading-7">{r.body}</p>
            </div>
          ))}
        </>
      ) : (
        <p className="mt-2 text-xs leading-6 text-cream-400">
          هنوز نظری ثبت نشده است. پس از تحویل خرید، می‌توانید از پنل خود نظر
          بنویسید.
        </p>
      )}
    </section>
  );
}
