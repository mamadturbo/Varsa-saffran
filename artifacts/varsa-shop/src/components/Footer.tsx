import { pagePath } from '@/lib/routes';
import { shopCategoryHref } from '@/lib/shop-filter';
import { Link } from 'wouter';
import { SITE } from '@/lib/site';
import { toFaDigits } from '@/lib/site';
import { VarsaLogo, ArabesqueDivider } from './Brand';
import { ContactDetails } from './ContactDetails';
import { SocialLinks } from './SocialLinks';
import { useState } from 'react';


const COLS = [
  {
    title: 'دسترسی سریع',
    links: [
      { href: pagePath('home'), label: 'صفحه نخست' },
      { href: pagePath('shop'), label: 'فروشگاه' },
      { href: pagePath('guide'), label: 'راهنمای انتخاب زعفران' },
      { href: pagePath('journal'), label: 'مجله دلگشا' },
      { href: pagePath('about'), label: 'داستان ورسا' },
      { href: pagePath('contact'), label: 'تماس و ارسال' },
    ],
  },
  {
    title: 'دسته‌بندی‌ها',
    links: [
      { href: shopCategoryHref('سوپر نگین'), label: 'زعفران سوپر نگین' },
      { href: shopCategoryHref('نگین'), label: 'زعفران نگین' },
      { href: shopCategoryHref('شبه نگین'), label: 'زعفران شبه نگین' },
      { href: shopCategoryHref('پوشال'), label: 'زعفران پوشال' },
    ],
  },
];

export function Footer() {
  const [enamadUnavailable, setEnamadUnavailable] = useState(false);
  return (
    <footer className="site-footer on-dark relative overflow-hidden border-t border-gold-500/15 bg-ink-950">
      <div className="absolute inset-0 bg-grid-gold opacity-30" />
      <div className="container-luxe relative z-10 py-16">
        {/* Mantra */}
        <div className="mb-14 text-center">
          <ArabesqueDivider className="mb-6" />
          <p className="footer-mantra font-display text-2xl text-cream-100 text-balance sm:text-3xl">
            <span className="gold-text">{SITE.mantra}</span>
          </p>
        </div>

        <div className="gold-rule mb-12" />

        <div className="footer-grid">
          {/* Brand */}
          <div className="footer-brand">
            <Link href="/" aria-label="ورسا — صفحه نخست" className="inline-flex">
              <VarsaLogo tone="gold" aria-hidden="true" className="h-24 w-40" />
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-7 text-cream-300">
              ورسا؛ برای سفره‌های ایرانی و هدیه‌های خوش‌عطر.
              محصولات را با توجه به دسته‌بندی، وزن و قیمت هر بسته انتخاب کنید.
            </p>
            <SocialLinks compact />
          </div>

          {/* Nav columns */}
          {COLS.map((col) => (
            <div key={col.title}>
              <h2 className="mb-4 text-sm font-semibold tracking-wide text-accent">
                {col.title}
              </h2>
              <ul className="space-y-1">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href}
                      className="inline-flex min-h-11 items-center text-sm text-cream-300 transition-colors hover:text-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact */}
          <div className="footer-contact">
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-accent">ارتباط با ما</h2>
            <ContactDetails />
            <Link href={pagePath('contact')} className="mt-3 inline-flex min-h-11 items-center text-sm text-accent underline underline-offset-4">فرم تماس با ورسا</Link>
            <div className="footer-enamad mt-6 flex flex-col items-start gap-3">
              <h3 className="text-sm font-medium text-cream-200">نماد اعتماد الکترونیکی</h3>
              <a
                referrerPolicy="origin"
                target="_blank"
                rel="noopener"
                href="https://trustseal.enamad.ir/?id=8724364&Code=p3tSvyuJjKosMQrfxrQThMH1UhWTN05V"
                aria-label="مشاهده شناسنامهٔ اینماد ورسا (در پنجرهٔ جدید)"
                className="inline-flex min-h-24 min-w-32 items-center justify-center rounded-xl bg-white p-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-400"
              >
                <img
                  referrerPolicy="origin"
                  src="https://trustseal.enamad.ir/logo.aspx?id=8724364&Code=p3tSvyuJjKosMQrfxrQThMH1UhWTN05V"
                  alt=""
                  style={{ cursor: 'pointer' }}
                  hidden={enamadUnavailable}
                  onError={() => setEnamadUnavailable(true)}
                  onLoad={() => setEnamadUnavailable(false)}
                  {...{ code: 'p3tSvyuJjKosMQrfxrQThMH1UhWTN05V' }}
                />
                {enamadUnavailable && <span className="max-w-36 text-center text-sm leading-7 text-[#15171C] underline underline-offset-4">مشاهده شناسنامهٔ اینماد</span>}
              </a>
            </div>
          </div>
        </div>

        <div className="gold-rule my-10" />

        <div className="flex flex-col items-center justify-between gap-3 text-center text-xs text-cream-400 sm:flex-row sm:text-right">
          <p>© {toFaDigits(new Date().getFullYear())} ورسا — تمام حقوق محفوظ است.</p>
          <p className="text-cream-500">طراحی و ساخت با عشق به زعفرانِ اصیلِ ایران</p>
          <details className="text-sm leading-8">
            <summary className="cursor-pointer min-h-11">منابع تصاویر</summary>
            <div className="flex flex-col gap-2 py-3">
              <a className="underline min-h-11" href={`${import.meta.env.BASE_URL}photos/saffron-farm-series-license.txt`}>عکس‌های مزرعه: صفا دانشور · CC BY-SA 3.0</a>
              <a className="underline min-h-11" href={`${import.meta.env.BASE_URL}photos/saffron-field-license.txt`}>عکس دشت زعفران: صفا دانشور · CC BY-SA 3.0</a>
            </div>
          </details>
        </div>
      </div>
    </footer>
  );
}
