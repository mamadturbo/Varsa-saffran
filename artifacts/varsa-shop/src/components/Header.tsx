import { useEffect } from 'react';
import { Menu, Moon, ShoppingBag, Sun, X } from 'lucide-react';
import { SITE } from '@/lib/site';
import { useCart } from '@/lib/cart';
import { useTheme } from '@/lib/theme';
import { useScrolled } from '@/lib/hooks';
import { VarsaMark } from './Brand';

interface HeaderProps {
  page: string;
  onNavigate: (page: string) => void;
}

const NAV = [
  { id: 'home', label: 'صفحه نخست' },
  { id: 'shop', label: 'فروشگاه' },
  { id: 'journal', label: 'مجله دلگشا' },
  { id: 'about', label: 'داستان ورسا' },
  { id: 'contact', label: 'تماس و ارسال' },
];

export function Header({ page, onNavigate }: HeaderProps) {
  const scrolled = useScrolled(30);
  const { count, open } = useCart();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    document.body.style.overflow = scrolled ? '' : '';
  }, [scrolled]);

  const go = (id: string) => {
    onNavigate(id);
    const menu = document.getElementById('mobile-menu');
    menu?.classList.add('translate-x-full');
  };

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-700 ease-luxe ${
          scrolled
            ? 'bg-ink-900/85 backdrop-blur-xl border-b border-gold-500/15 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]'
            : 'bg-transparent'
        }`}
      >
        <div className="container-luxe flex h-20 items-center justify-between gap-4">
          {/* Logo */}
          <button
            onClick={() => go('home')}
            className="group flex items-center gap-3"
            aria-label="ورسا — صفحه نخست"
          >
            <VarsaMark className="h-10 w-10 transition-transform duration-700 ease-luxe group-hover:rotate-[18deg]" />
            <span className="flex flex-col items-start leading-none">
              <span
                className={`font-display text-2xl font-bold ${
                  scrolled ? 'text-cream-50' : 'text-white'
                }`}
              >
                ورسا
              </span>
              <span className="mt-1 text-[10px] tracking-[0.3em] text-gold-400/80">VARSA</span>
            </span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`relative rounded-full px-5 py-2 text-sm font-medium transition-all duration-500 ease-luxe ${
                  page === item.id
                    ? 'text-gold-200'
                    : scrolled
                      ? 'text-cream-200/80 hover:text-cream-50'
                      : 'text-white/80 hover:text-white'
                }`}
              >
                {item.label}
                <span
                  className={`absolute inset-x-5 -bottom-0.5 h-px bg-gold-500 transition-all duration-500 ${
                    page === item.id ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-500/25 text-gold-200 transition-all duration-500 ease-luxe hover:border-gold-400 hover:bg-gold-500/10 hover:text-gold-100"
              aria-label={theme === 'dark' ? 'حالت روشن' : 'حالت تیره'}
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" strokeWidth={1.5} />
              ) : (
                <Moon className="h-5 w-5" strokeWidth={1.5} />
              )}
            </button>

            {/* Cart */}
            <button
              onClick={open}
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-gold-500/25 text-gold-200 transition-all duration-500 ease-luxe hover:border-gold-400 hover:bg-gold-500/10 hover:text-gold-100"
              aria-label="سبد خرید"
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-crimson-600 px-1 text-[10px] font-bold text-cream-50">
                  {count > 9 ? '۹+' : '۰۱۲۳۴۵۶۷۸۹'[count]}
                </span>
              )}
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => {
                const menu = document.getElementById('mobile-menu');
                menu?.classList.toggle('translate-x-full');
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-500/25 text-gold-200 transition-colors hover:bg-gold-500/10 lg:hidden"
              aria-label="منو"
            >
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className="fixed inset-0 z-[60] translate-x-full bg-ink-950/98 backdrop-blur-xl transition-transform duration-500 ease-luxe lg:hidden"
      >
        <div className="flex h-20 items-center justify-between px-6">
          <span className="font-display text-2xl text-cream-50">ورسا</span>
          <button
            onClick={() => document.getElementById('mobile-menu')?.classList.add('translate-x-full')}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-500/25 text-gold-200"
            aria-label="بستن منو"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
        <nav className="flex flex-col gap-2 px-6 pt-6">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              className={`flex items-center justify-between rounded-xl px-5 py-4 text-lg font-medium transition-colors ${
                page === item.id
                  ? 'bg-gold-500/10 text-gold-200'
                  : 'text-cream-200/80 hover:bg-white/5 hover:text-cream-50'
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="mt-6 rounded-xl border border-gold-500/15 bg-white/[0.03] p-5 text-sm text-cream-300">
            <p className="text-gold-200">{SITE.phone}</p>
            <p className="mt-1 text-cream-400">{SITE.shipping}</p>
          </div>
        </nav>
      </div>
    </>
  );
}
