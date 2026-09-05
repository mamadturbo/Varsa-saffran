import { Instagram, Mail, MapPin, Phone, Send } from 'lucide-react';
import { SITE } from '@/lib/site';
import { toFaDigits } from '@/lib/site';
import { VarsaMark, ArabesqueDivider } from './Brand';

interface FooterProps {
  onNavigate: (page: string) => void;
}

const COLS = [
  {
    title: 'گشتنِ ورسا',
    links: [
      { id: 'home', label: 'صفحه نخست' },
      { id: 'shop', label: 'فروشگاه' },
      { id: 'journal', label: 'مجله دلگشا' },
      { id: 'about', label: 'داستان ورسا' },
      { id: 'contact', label: 'تماس و ارسال' },
    ],
  },
  {
    title: 'دسته‌بندی‌ها',
    links: [
      { id: 'shop', label: 'زعفران سوپر نگین' },
      { id: 'shop', label: 'زعفران نگین' },
      { id: 'shop', label: 'زعفران شبه نگین' },
      { id: 'shop', label: 'زعفران پوشال' },
    ],
  },
];

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="relative overflow-hidden border-t border-gold-500/15 bg-ink-950">
      <div className="absolute inset-0 bg-grid-gold opacity-30" />
      <div className="container-luxe relative z-10 py-16">
        {/* Mantra */}
        <div className="mb-14 text-center">
          <ArabesqueDivider className="mb-6" />
          <p className="font-display text-2xl text-cream-100 text-balance sm:text-3xl">
            <span className="gold-text">{SITE.mantra}</span>
          </p>
        </div>

        <div className="gold-rule mb-12" />

        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              <VarsaMark className="h-12 w-12" />
              <div>
                <p className="font-display text-2xl text-cream-50">ورسا</p>
                <p className="text-[10px] tracking-[0.3em] text-gold-400/80">VARSA · دلگشا</p>
              </div>
            </div>
            <p className="mt-5 max-w-xs text-sm leading-7 text-cream-300">
              زعفرانی ارگانیک از دلِ کویرِ ایران؛ بدون دخالت دست، با بسته‌بندی فلزی
              اختصاصی، برای سفره‌های اصیل شما.
            </p>
            <div className="mt-5 flex gap-3">
              <a
                href={SITE.instagram}
                target="_blank"
                rel="noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-500/25 text-gold-200 transition-colors hover:bg-gold-500/10 hover:text-gold-100"
                aria-label="اینستاگرام"
              >
                <Instagram className="h-4 w-4" strokeWidth={1.5} />
              </a>
              <a
                href={SITE.telegram}
                target="_blank"
                rel="noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-500/25 text-gold-200 transition-colors hover:bg-gold-500/10 hover:text-gold-100"
                aria-label="تلگرام"
              >
                <Send className="h-4 w-4" strokeWidth={1.5} />
              </a>
            </div>
          </div>

          {/* Nav columns */}
          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-sm font-semibold tracking-wide text-gold-200">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => onNavigate(link.id)}
                      className="text-sm text-cream-300 transition-colors hover:text-gold-200"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact */}
          <div>
            <h4 className="mb-4 text-sm font-semibold tracking-wide text-gold-200">ارتباط با ما</h4>
            <ul className="space-y-3 text-sm text-cream-300">
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 text-gold-400" strokeWidth={1.5} />
                <span dir="ltr">{toFaDigits(SITE.phone)}</span>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 text-gold-400" strokeWidth={1.5} />
                <span dir="ltr">{SITE.email}</span>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-gold-400" strokeWidth={1.5} />
                <span>{SITE.address}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="gold-rule my-10" />

        <div className="flex flex-col items-center justify-between gap-3 text-center text-xs text-cream-400 sm:flex-row sm:text-right">
          <p>© {toFaDigits(new Date().getFullYear())} ورسا — تمام حقوق محفوظ است.</p>
          <p className="text-cream-500">طراحی و ساخت با عشق به زعفرانِ اصیلِ ایران</p>
        </div>
      </div>
    </footer>
  );
}
