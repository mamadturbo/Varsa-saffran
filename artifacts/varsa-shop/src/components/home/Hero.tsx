import { DeliveryImage } from '@/components/DeliveryImage';
import { pagePath } from '@/lib/routes';
import { Link } from 'wouter';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { HERO_SLIDES, toFaDigits } from '@/lib/site';
import { useStoreContent } from '@/lib/store-content';
import { SAFFRON_PHOTOS } from '@/lib/saffron-photos';


export function Hero() {
  const content = useStoreContent();
  const slides = (content?.banners.length ? content.banners : HERO_SLIDES.map(s => ({...s, link: '/shop'}))).map((slide, i) => i === 2 ? { ...slide, image: SAFFRON_PHOTOS.field.src } : slide);
  const [index, setIndex] = useState(0);
  const current = slides[index] ?? slides[0];
  const touch = useRef<{x: number; y: number} | null>(null);
  const [interacted, setInteracted] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (reducedMotion || interacted || hovered || focused || slides.length < 2) return;
    const timer = window.setInterval(() => setIndex(i => (i + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, [reducedMotion, interacted, hovered, focused, slides.length]);
  const select = (next: number) => { setInteracted(true); setIndex(next); };
  const go = (step: number) => { setInteracted(true); setIndex(i => (i + step + slides.length) % slides.length); };

  return (
    <section className="hero on-dark relative flex min-h-[max(640px,100svh)] w-full items-center overflow-hidden pb-24 pt-28 sm:py-32" aria-label="معرفی ورسا"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onTouchStart={event => { const point = event.touches[0]; touch.current = {x: point.clientX, y: point.clientY}; }}
      onTouchEnd={event => { const start = touch.current; touch.current = null; if (!start) return; const point = event.changedTouches[0]; const dx = point.clientX - start.x; const dy = point.clientY - start.y; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1); }}
      onTouchCancel={() => { touch.current = null; }}>
      {slides.map((slide, i) => (
        <div key={`${i}-${slide.image}`} aria-hidden="true"
          className={`absolute inset-0 transition-opacity duration-[1600ms] ease-luxe ${i === index ? 'opacity-100' : 'opacity-0'}`}>
          <DeliveryImage sizes="100vw" src={slide.image} alt="" loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'auto'} decoding="async"
            className={`h-full w-full object-cover ${i === index && !reducedMotion ? 'animate-slow-zoom' : ''}`} />
        </div>
      ))}
      <div aria-hidden="true" className="hero-shade absolute inset-0" />
      {/* Content */}
      <div className="hero-content relative z-10 w-full">
        <div className="container-luxe">
          <div className="hero-message max-w-3xl">
            <span
              className="hero-eyebrow inline-flex items-center rounded-full border border-gold-500/30 bg-ink-950/40 px-4 py-2 text-xs font-medium tracking-wide text-accent backdrop-blur-sm"
            >
              {current.eyebrow}
            </span>

            <h1
              tabIndex={-1}
              key={`title-${index}`}
              className="hero-title motion-safe:animate-fade-up mt-6 font-display text-[clamp(2rem,6vw,3.75rem)] font-bold leading-[1.6] text-cream-50 text-balance [text-shadow:0_2px_18px_rgba(0,0,0,.65)] sm:mt-8"
            >
              {current.title.split('؛').map((part, i) => (
                <span key={i} className="block first:mb-2">
                  {i === 0 ? <span className="gold-text">{part}</span> : part}
                </span>
              ))}
            </h1>

            <p
              key={`sub-${index}`}
              className="hero-description motion-safe:animate-fade-up mt-5 max-w-xl sm:mt-8 text-base leading-8 text-cream-200 text-pretty [text-shadow:0_2px_8px_rgba(0,0,0,.8)] sm:text-lg sm:leading-9"
            >
              {current.subtitle}
            </p>

            <div className="hero-actions mt-7 flex flex-wrap gap-3 sm:mt-10 sm:gap-4">
              <Link href={current.link} className="btn-solid">
                مشاهده محصولات
                <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              </Link>
              <Link href={pagePath('journal')} className="btn-gold">
                مجله دلگشا
                <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
              </Link>
            </div>
          </div>
        </div>
      </div>


      {/* Manual navigation stops automatic rotation. */}
      <div role="group" aria-label="انتخاب اسلاید" className="hero-navigation absolute bottom-5 left-1/2 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-1 rounded-full border border-white/25 bg-black/40 p-1 backdrop-blur-md"
        onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); go(event.key === 'ArrowLeft' ? 1 : -1); } }}>
        <button type="button" onClick={() => go(-1)} aria-label="اسلاید قبلی" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-cream-50 hover:bg-white/15"><ChevronRight aria-hidden="true" className="h-5 w-5"/></button>
        <div className="flex flex-wrap justify-center">
          {slides.map((_, i) => <button type="button" key={i} onClick={() => select(i)} className="flex h-11 w-11 items-center justify-center rounded-full" aria-label={`اسلاید ${toFaDigits(i + 1)}`} aria-pressed={i === index}>
            <span className={`h-1.5 rounded-full ${i === index ? 'w-7 bg-white' : 'w-2.5 bg-white/60'}`} />
          </button>)}
        </div>
        <button type="button" onClick={() => go(1)} aria-label="اسلاید بعدی" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-cream-50 hover:bg-white/15"><ChevronLeft aria-hidden="true" className="h-5 w-5"/></button>
      </div>
      <span className="sr-only" role="status" aria-live="polite">اسلاید {toFaDigits(index + 1)} از {toFaDigits(slides.length)}</span>

    </section>
  );
}
