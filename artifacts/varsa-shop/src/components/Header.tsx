import { CHECKOUT_PATHS, pagePath } from '@/lib/routes';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Menu, Moon, ShoppingBag, Sun, X, UserRound } from 'lucide-react';
import { SITE, toFaDigits } from '@/lib/site';
import { useStoreContact, useShippingInfo } from '@/lib/store-content';
import { useCart } from '@/lib/cart';
import { useTheme } from '@/lib/theme';
import { useScrolled } from '@/lib/hooks';
import { VarsaLogo } from './Brand';
import { StoreDialog, StoreDialogTitle } from './StoreDialog';

interface HeaderProps {
  page: string;
}

const NAV = [
  { id: 'home', label: 'صفحه نخست' },
  { id: 'shop', label: 'فروشگاه' },
  { id: 'journal', label: 'مجله دلگشا' },
  { id: 'about', label: 'داستان ورسا' },
  { id: 'contact', label: 'تماس و ارسال' },
];

export function Header({ page }: HeaderProps) {
  const CONTACT = useStoreContact();
  const shipping = useShippingInfo();
  const scrolled = useScrolled(30);
  const { count } = useCart();
  const { theme, toggle } = useTheme();


  const [menuOpen, setMenuOpen] = useState(false);
  const menuTitle = useRef<HTMLHeadingElement>(null);
  const menuNavigated = useRef(false);
  const closeMenu = () => setMenuOpen(false);
  const navigateFromMenu = () => { menuNavigated.current = true; setMenuOpen(false); };
  useEffect(() => { setMenuOpen(false); }, [page]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1280px)');
    const resized = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener('change', resized);
    return () => desktop.removeEventListener('change', resized);
  }, []);

  return (
    <>
      <header
        className={`store-header fixed inset-x-0 top-0 z-50 bg-ink-900/95 backdrop-blur-xl transition-all duration-700 ease-luxe ${
          scrolled
            ? 'bg-ink-900/85 backdrop-blur-xl border-b border-gold-500/15 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]'
            : ''
        }`}
      >
        <div className="container-luxe flex h-20 items-center justify-between gap-2 sm:gap-4">
          {/* Logo */}
          <Link href="/" onClick={closeMenu}
            data-focus-fallback=""
            className="group flex shrink-0 items-center gap-2 sm:gap-3"
            aria-label="ورسا — صفحه نخست"
          >
            <VarsaLogo aria-hidden="true" className="h-14 w-[90px] shrink-0 sm:h-16 sm:w-[104px]" />
          </Link>

          {/* Desktop nav */}
          <nav aria-label="ناوبری اصلی" className="hidden items-center gap-1 xl:flex">
            {NAV.map((item) => (
              <Link key={item.id} href={pagePath(item.id)} onClick={closeMenu} aria-current={page === item.id ? "page" : undefined}
                className={`relative inline-flex min-h-11 items-center rounded-full px-5 py-2 text-sm font-medium transition-all duration-500 ease-luxe ${
                  page === item.id
                    ? 'text-accent'
                    : 'text-cream-200 hover:text-cream-50'
                }`}
              >
                {item.label}
                <span
                  className={`absolute inset-x-5 -bottom-0.5 h-px bg-gold-500 transition-all duration-500 ${
                    page === item.id ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link href="/account" aria-label="حساب کاربری من" className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-500/25 text-accent"><UserRound className="h-5 w-5" strokeWidth={1.5}/></Link>
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-500/25 text-accent transition-all duration-500 ease-luxe hover:border-gold-400 hover:bg-gold-500/10 hover:text-accent"
              aria-label={theme === 'dark' ? 'حالت روشن' : 'حالت تیره'}
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" strokeWidth={1.5} />
              ) : (
                <Moon className="h-5 w-5" strokeWidth={1.5} />
              )}
            </button>

            {/* Cart */}
            <Link
              href={CHECKOUT_PATHS.cart}
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-gold-500/25 text-accent transition-all duration-500 ease-luxe hover:border-gold-400 hover:bg-gold-500/10 hover:text-accent"
              aria-label="سبد خرید"
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-700 px-1 text-[10px] font-bold text-white dark:bg-crimson-600">
                  {count > 9 ? '۹+' : '۰۱۲۳۴۵۶۷۸۹'[count]}
                </span>
              )}
            </Link>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-500/25 text-accent transition-colors hover:bg-gold-500/10 xl:hidden"
              aria-label="منو"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <StoreDialog
        id="mobile-menu"
        open={menuOpen} onClose={closeMenu} layer={60} initialFocus={menuTitle}
        focusAfterClose={() => {
          if (!menuNavigated.current) return null;
          menuNavigated.current = false;
          return document.querySelector<HTMLElement>('main h1[tabindex="-1"]');
        }}
        className="on-dark mobile-menu fixed inset-0 overflow-y-auto bg-ink-950/98 pb-8 outline-none"
      >
        <div className="flex h-20 items-center justify-between px-6">
          <StoreDialogTitle asChild><h2 ref={menuTitle} tabIndex={-1} className="font-display text-2xl text-cream-50">منوی ورسا</h2></StoreDialogTitle>
          <button
            onClick={closeMenu}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-500/25 text-accent"
            aria-label="بستن منو"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
        <nav aria-label="ناوبری موبایل" className="flex flex-col gap-2 px-6 pt-6">
          {NAV.map((item) => (
            <Link key={item.id} href={pagePath(item.id)} onClick={navigateFromMenu} aria-current={page === item.id ? "page" : undefined}
              className={`flex items-center justify-between rounded-xl px-5 py-4 text-lg font-medium transition-colors ${
                page === item.id
                  ? 'bg-gold-500/10 text-accent'
                  : 'text-cream-200/80 hover:bg-white/5 hover:text-cream-50'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-6 rounded-xl border border-gold-500/15 bg-white/[0.03] p-5 text-sm text-cream-300">
            {CONTACT.phone ? <a href={CONTACT.phone.href} dir="ltr" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{toFaDigits(CONTACT.phone.label)}</a>
              : <Link href={pagePath('contact')} onClick={navigateFromMenu} className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">فرم تماس با ورسا</Link>}
            <p className="mt-1 text-cream-400">{shipping}</p>
          </div>
        </nav>
      </StoreDialog>
    </>
  );
}
