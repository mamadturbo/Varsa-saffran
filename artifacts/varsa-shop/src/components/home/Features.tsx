import { Layers, Scale, Package, Truck } from 'lucide-react';
import { ArabesqueDivider } from '@/components/Brand';



const FEATURES = [
  {
    icon: Layers,
    title: 'انتخاب دسته‌بندی',
    text: 'محصولات هر دسته را جدا ببینید و توضیحات هر بسته را بررسی کنید.',
  },
  {
    icon: Scale,
    title: 'مقایسه وزن و قیمت',
    text: 'وزن خالص و قیمت هر بسته در فروشگاه را بررسی کنید و بر اساس نیاز خود بستهٔ مورد نظر را انتخاب کنید.',
  },
  {
    icon: Package,
    title: 'جزئیات هر محصول',
    text: 'جزئیات هر محصول را به‌طور کامل و دقیق ببینید.',
  },
  {
    icon: Truck,
    title: 'اطلاعات ارسال',
    text: 'پیش از ثبت سفارش، توضیحات ارسال و هزینهٔ نمایش‌داده‌شده را بررسی کنید.',
  },
];

export function Features() {

  return (
    <section className="relative border-y border-gold-500/10 bg-ink-800/60 py-20">
      <div className="absolute inset-0 bg-grid-gold opacity-20" />
      <div className="container-luxe relative z-10">
        <div className="mb-14 text-center">
          <h2 className="font-display text-3xl font-bold text-cream-50 sm:text-4xl">
            انتخاب با <span className="gold-text">اطلاعات روشن</span>
          </h2>
          <ArabesqueDivider className="mt-5" />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`reveal reveal-delay-${i + 1} card-luxe group p-7 text-center`}
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/5 transition-all duration-700 ease-luxe group-hover:border-gold-400 group-hover:shadow-gold">
                <f.icon className="h-7 w-7 text-accent" strokeWidth={1.3} />
              </div>
              <h3 className="mb-3 text-base font-semibold text-cream-50">{f.title}</h3>
              <p className="text-sm leading-7 text-cream-300">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
