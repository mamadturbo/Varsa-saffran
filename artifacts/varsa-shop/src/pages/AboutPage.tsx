import { pagePath } from '@/lib/routes';
import { Link } from 'wouter';
import { ArrowLeft, Layers, Scale, Package, ShoppingBag } from 'lucide-react';
import { SAFFRON_PHOTOS } from '@/lib/saffron-photos';
import { useReveal } from '@/lib/hooks';
import { SectionHeading } from '@/components/SectionHeading';
import { ArabesqueDivider } from '@/components/Brand';
import { SaffronPhoto } from '@/components/SaffronPhoto';


const STEPS = [
  {
    icon: Layers,
    step: '۰۱',
    title: 'دسته را انتخاب کنید',
    text: 'در فروشگاه، محصولات را بر اساس دسته‌بندی جدا کنید و توضیحات آن‌ها را بخوانید.',
  },
  {
    icon: Scale,
    step: '۰۲',
    title: 'وزن و قیمت را بسنجید',
    text: 'وزن خالص و قیمت بسته‌ها را با توجه به میزان مصرف و بودجه خود مقایسه کنید.',
  },
  {
    icon: Package,
    step: '۰۳',
    title: 'جزئیات را بخوانید',
    text: 'توضیحات محصول و محتویات بسته را پیش از افزودن به سبد بررسی کنید.',
  },
  {
    icon: ShoppingBag,
    step: '۰۴',
    title: 'سبد را بررسی کنید',
    text: 'تعداد و جمع کالاها را در سبد ببینید. پرداخت آنلاین هنوز فعال نیست و شرایط ارسال نهایی نشده است.',
  },
];

export function AboutPage() {
  const ref = useReveal<HTMLElement>();

  return (
    <main ref={ref} className="pt-32">
      {/* Hero */}
      <section className="relative overflow-hidden py-16">
        <div className="container-luxe text-center">
          <SectionHeading as="h1"
            eyebrow="داستان ورسا"
            title={<>ورسا؛ <span className="gold-text">دلگشای سفره‌های اصیل</span></>}
            subtitle="زعفران در آشپزی و مهمان‌نوازی ایرانی جای ویژه‌ای دارد. هویت ورسا از عطر زعفران، هنر و لحظه‌های کنار هم بودن الهام می‌گیرد."
          />
        </div>
      </section>

      {/* Story narrative */}
      <section className="py-16">
        <div className="container-luxe">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div className="reveal relative">
              <SaffronPhoto photo={SAFFRON_PHOTOS.flowers} />
            </div>
            <div className="reveal reveal-delay-1">
              <h2 className="font-display text-2xl font-bold text-cream-50">
                ارادت به خاکِ ایران
              </h2>
              <ArabesqueDivider className="my-5 justify-start" />
              <div className="space-y-4 text-base leading-8 text-cream-300 text-pretty">
                <p>
                  ما به سفره ایرانی و خاطره‌هایی که دور آن شکل می‌گیرد علاقه داریم؛
                  از عطر برنج زعفرانی در خانه تا هدیه‌ای برای یک دیدار.
                </p>
                <p>
                  «دلگشا» بیان این نگاه در هویت ورساست. در فروشگاه می‌توانید
                  محصولات را با توجه به دسته‌بندی، وزن و قیمت هر بسته انتخاب کنید.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="relative border-y border-gold-500/10 bg-ink-800/50 py-20">
        <div className="absolute inset-0 bg-grid-gold opacity-20" />
        <div className="container-luxe relative z-10">
          <SectionHeading
            eyebrow="انتخاب در ورسا"
            title={<>از مقایسه تا <span className="gold-text">سبد خرید</span></>}
            subtitle="این چهار قدم کمک می‌کند اطلاعات بسته‌ها را پیش از ثبت درخواست سفارش بررسی کنید."
          />

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((p, i) => (
              <div
                key={p.step}
                className={`reveal reveal-delay-${i + 1} card-luxe relative p-7`}
              >
                <span className="absolute left-5 top-4 font-display text-5xl font-bold text-gold-500/15">
                  {p.step}
                </span>
                <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/5">
                  <p.icon className="h-6 w-6 text-accent" strokeWidth={1.3} />
                </div>
                <h3 className="mb-2 text-base font-semibold text-cream-50">{p.title}</h3>
                <p className="text-sm leading-7 text-cream-300">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Packaging highlight */}
      <section className="py-20">
        <div className="container-luxe">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div className="reveal reveal-delay-1 order-2 lg:order-1">
              <span className="chip mb-4">زعفران در زندگی روزمره</span>
              <h2 className="font-display text-2xl font-bold text-cream-50">
                عطر زعفران، برای سفره و هدیه
              </h2>
              <ArabesqueDivider className="my-5 justify-start" />
              <p className="text-base leading-8 text-cream-300 text-pretty">
                عکس‌های این صفحه، گل و رشته‌های واقعی زعفران را نشان می‌دهند.
                برای انتخاب، مشخصات و توضیحات همان محصول را بخوانید؛ به‌ویژه
                در بسته‌های هدیه که وزن و محتویات متفاوتی دارند.
              </p>
              <Link href={pagePath('shop')} className="btn-gold mt-8">
                مشاهده‌ی محصولات
                <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              </Link>
            </div>
            <div className="reveal order-1 lg:order-2 relative">
              <SaffronPhoto photo={SAFFRON_PHOTOS.spoon} />
              <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-gold-500/10 blur-3xl" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

