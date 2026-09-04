import { ArrowLeft } from 'lucide-react';
import { GALLERY_IMAGE } from '@/lib/site';
import { ArabesqueDivider } from '@/components/Brand';

interface CtaBannerProps {
  onNavigate: (page: string) => void;
}

export function CtaBanner({ onNavigate }: CtaBannerProps) {
  return (
    <section className="relative overflow-hidden py-32">
      <img
        src={GALLERY_IMAGE}
        alt="بسته‌بندی ورسا"
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-ink-950/80" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/60 to-ink-950/80" />

      <div className="container-luxe relative z-10 text-center">
        <ArabesqueDivider className="mb-8" />
        <h2 className="reveal mx-auto max-w-3xl font-display text-3xl font-bold leading-tight text-cream-50 text-balance sm:text-4xl lg:text-5xl">
          عطرِ کویر را <span className="gold-text">چشیده‌اید؟</span>
        </h2>
        <p className="reveal reveal-delay-1 mx-auto mt-6 max-w-xl text-lg leading-8 text-cream-200 text-pretty">
          از مزرعه‌ی ارگانیکِ ما تا سفره‌ی شما، فقط یک بسته‌ی فلزیِ پر از عطر فاصله است.
        </p>
        <div className="reveal reveal-delay-2 mt-10 flex flex-wrap justify-center gap-4">
          <button onClick={() => onNavigate('shop')} className="btn-solid">
            همین حالا سفارش دهید
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          </button>
          <button onClick={() => onNavigate('about')} className="btn-ghost">
            داستان ما را بخوانید
          </button>
        </div>
      </div>
    </section>
  );
}
