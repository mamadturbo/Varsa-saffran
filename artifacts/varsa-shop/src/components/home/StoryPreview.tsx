import { pagePath } from '@/lib/routes';
import { Link } from 'wouter';
import { ArrowLeft, Quote } from 'lucide-react';
import { SAFFRON_PHOTOS } from '@/lib/saffron-photos';
import { SectionHeading } from '@/components/SectionHeading';
import { SaffronPhoto } from '@/components/SaffronPhoto';


export function StoryPreview() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="container-luxe">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Images */}
          <div className="reveal relative">
            <div className="grid items-start grid-cols-2 gap-4">
              <SaffronPhoto photo={SAFFRON_PHOTOS.torbatFlowers} sizes="(min-width: 1280px) 276px, (min-width: 1024px) calc((100vw - 176px) / 4), (min-width: 640px) calc((100vw - 80px) / 2), calc((100vw - 64px) / 2)" />
              <SaffronPhoto photo={SAFFRON_PHOTOS.torbatPicking} className="pt-10" sizes="(min-width: 1280px) 276px, (min-width: 1024px) calc((100vw - 176px) / 4), (min-width: 640px) calc((100vw - 80px) / 2), calc((100vw - 64px) / 2)" />
            </div>
            <div className="pointer-events-none absolute -inset-6 -z-10 rounded-full bg-gold-500/10 blur-3xl" />
          </div>

          {/* Text */}
          <div>
            <SectionHeading
              center={false}
              title={<>ورسا؛ <span className="gold-text">دلگشای سفره‌های اصیل</span></>}
              subtitle="عطر زعفران بخشی از خاطره آشپزی ایرانی است. ورسا با الهام از این خاطره، محصولات زعفران را برای آشپزی و هدیه معرفی می‌کند."
            />

            <div className="reveal reveal-delay-3 mt-8 rounded-2xl border border-gold-500/20 bg-gradient-to-b from-gold-500/[0.06] to-transparent p-6">
              <Quote className="h-6 w-6 text-gold-400/70" strokeWidth={1.2} />
              <p className="mt-3 text-base leading-8 text-cream-200 text-pretty">
                برای ما، سفره جایی برای کنار هم بودن است؛ از غذای روزمره تا مهمانی
                و هدیه‌ای که به یادگار می‌ماند. «دلگشا» بیان همین نگاه در هویت ورساست.
              </p>
            </div>

            <Link href={pagePath('about')}
              className="reveal reveal-delay-4 btn-gold mt-8"
            >
              خواندن داستان کامل
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
