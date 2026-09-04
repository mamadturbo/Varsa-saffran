import { ArrowLeft, Leaf, Hand, Package, Sprout } from 'lucide-react';
import { STORY_IMAGES, QUALITY_IMAGES } from '@/lib/site';
import { useReveal } from '@/lib/hooks';
import { SectionHeading } from '@/components/SectionHeading';
import { ArabesqueDivider } from '@/components/Brand';

interface AboutPageProps {
  onNavigate: (page: string) => void;
}

const PROCESS = [
  {
    icon: Sprout,
    step: '۰۱',
    title: 'کشت ارگانیک',
    text: 'در دلِ کویر، بدون هیچ سم یا کود شیمیایی، گل‌های زعفران در خاکی پاک ریشه می‌کنند.',
  },
  {
    icon: Hand,
    step: '۰۲',
    title: 'برداشت بدون دخالت دست',
    text: 'گل‌ها با روش‌های مکانیکی و استاندارد چیده و ضدعفونی می‌شوند؛ هیچ دستی به کلاله‌ها نمی‌رسد.',
  },
  {
    icon: Package,
    step: '۰۳',
    title: 'بسته‌بندی فلزی',
    text: 'کلاله‌های خشک‌شده در بسته‌بندی فلزی اختصاصی با درب دوگانه و لیبل ورسا عرضه می‌شوند.',
  },
  {
    icon: Leaf,
    step: '۰۴',
    title: 'ارسال امن',
    text: 'با تیپاکس و بسته‌بندی ضربه‌گیر، عطر زعفران تا سفره‌ی شما سالم می‌رسد.',
  },
];

export function AboutPage({ onNavigate }: AboutPageProps) {
  const ref = useReveal<HTMLElement>();

  return (
    <main ref={ref} className="pt-32">
      {/* Hero */}
      <section className="relative overflow-hidden py-16">
        <div className="container-luxe text-center">
          <SectionHeading
            eyebrow="داستان ورسا"
            title={<>دلگشا؛ نامی از <span className="gold-text">دلِ زبان فارسی</span></>}
            subtitle="ورسا، برگرفته از «ور» به معنای سینه و دل، و «سا» به معنای گشاینده؛ روی هم «دلگشا». این برند، زعفرانی اصیل از دل کویر ایران را با هویتی هنری و مجلل به خانه‌ها و رستوران‌های ایران زمین می‌آورد."
          />
        </div>
      </section>

      {/* Story narrative */}
      <section className="py-16">
        <div className="container-luxe">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div className="reveal relative">
              <img
                src={STORY_IMAGES.field}
                alt="مزرعه‌ی زعفران در کویر"
                loading="lazy"
                className="aspect-[4/3] w-full rounded-3xl object-cover shadow-2xl"
              />
              <div className="absolute -bottom-8 -left-8 hidden w-44 overflow-hidden rounded-2xl border-4 border-ink-900 shadow-2xl sm:block">
                <img
                  src={STORY_IMAGES.flower}
                  alt="گلچه‌ی زعفران"
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              </div>
            </div>
            <div className="reveal reveal-delay-1">
              <h3 className="font-display text-2xl font-bold text-cream-50">
                ارادت به خاکِ ایران
              </h3>
              <ArabesqueDivider className="my-5 justify-start" />
              <div className="space-y-4 text-base leading-8 text-cream-300 text-pretty">
                <p>
                  ما به خاکی که زعفرانِ ناب در آن می‌روید، عشق می‌ورزیم. هر گل، تنها
                  یک‌بار و در سایه‌ی سپیده‌دمِ کویر شکوفا می‌شود؛ و ما ارجِ این
                  لحظه‌ی ناب را در هر بسته‌ی ورسا حفظ می‌کنیم.
                </p>
                <p>
                  ورسا فقط یک برند زعفران نیست؛ روایتی است از دلگشایی، از هنرِ کویر
                  و از اصالتی که در سفره‌های ایرانی جاری است. ما زعفرانی را که خود
                  با چشمِ قلب می‌بینیم، به سفره‌ی شما هدیه می‌دهیم.
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
            eyebrow="از مزرعه تا سفره"
            title={<>فرآیند <span className="gold-text">اصیل</span> ورسا</>}
            subtitle="هر مرحله، با عشق و بدون دخالت دست؛ تا عطر کویر دست‌نخورده به سفره‌ی شما برسد."
          />

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS.map((p, i) => (
              <div
                key={p.step}
                className={`reveal reveal-delay-${i + 1} card-luxe relative p-7`}
              >
                <span className="absolute left-5 top-4 font-display text-5xl font-bold text-gold-500/15">
                  {p.step}
                </span>
                <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/5">
                  <p.icon className="h-6 w-6 text-gold-300" strokeWidth={1.3} />
                </div>
                <h4 className="mb-2 text-base font-semibold text-cream-50">{p.title}</h4>
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
              <span className="chip mb-4">بسته‌بندی فلزی اختصاصی</span>
              <h3 className="font-display text-2xl font-bold text-cream-50">
                نگهبانِ عطر، تا لحظه‌ی مصرف
              </h3>
              <ArabesqueDivider className="my-5 justify-start" />
              <p className="text-base leading-8 text-cream-300 text-pretty">
                بسته‌بندی فلزی ورسا با درب دوگانه و لیبل اختصاصی، عطر و رطوبتِ زعفران
                را کامل حفظ می‌کند. هر بسته، مانند قفلی از هنر، عطرِ کویر را تا
                لحظه‌ی باز شدن در سفره‌ی شما نگه می‌دارد.
              </p>
              <button onClick={() => onNavigate('shop')} className="btn-gold mt-8">
                مشاهده‌ی محصولات
                <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <div className="reveal order-1 lg:order-2 relative">
              <img
                src={QUALITY_IMAGES.spoon}
                alt="زعفران ورسا"
                loading="lazy"
                className="aspect-[4/3] w-full rounded-3xl object-cover shadow-2xl"
              />
              <div className="pointer-events-none absolute -inset-6 -z-10 rounded-full bg-gold-500/10 blur-3xl" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
