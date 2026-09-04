import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { HERO_SLIDES, toFaDigits } from '@/lib/site';

interface HeroProps {
  onNavigate: (page: string) => void;
}

export function Hero({ onNavigate }: HeroProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, 6500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative h-screen min-h-[640px] w-full overflow-hidden">
      {/* Slides */}
      {HERO_SLIDES.map((slide, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-[1600ms] ease-luxe ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img
            src={slide.image}
            alt={slide.title}
            className={`h-full w-full object-cover ${
              i === index ? 'animate-slow-zoom' : ''
            }`}
          />
          <div className="absolute inset-0 img-overlay-hero" />
          <div className="absolute inset-0 img-overlay-hero-side" />
        </div>
      ))}

      {/* Content */}
      <div className="relative z-10 flex h-full items-center">
        <div className="container-luxe">
          <div className="max-w-3xl">
            <span className="inline-flex animate-fade-in items-center gap-2 rounded-full border border-gold-500/30 bg-ink-950/40 px-4 py-2 text-xs tracking-[0.2em] text-gold-200 backdrop-blur-sm">
              {HERO_SLIDES[index].eyebrow}
            </span>

            <h1
              key={`title-${index}`}
              className="mt-8 animate-fade-up font-display text-4xl font-bold leading-[1.3] text-white text-balance sm:text-5xl lg:text-6xl"
            >
              {HERO_SLIDES[index].title.split('؛').map((part, i) => (
                <span key={i} className="block first:mb-2">
                  {i === 0 ? <span className="gold-text">{part}</span> : part}
                </span>
              ))}
            </h1>

            <p
              key={`sub-${index}`}
              className="mt-8 max-w-xl animate-fade-up text-lg leading-9 text-white/85 text-pretty [animation-delay:0.15s]"
            >
              {HERO_SLIDES[index].subtitle}
            </p>

            <div className="mt-12 flex animate-fade-up flex-wrap gap-4 [animation-delay:0.3s]">
              <button onClick={() => onNavigate('shop')} className="btn-solid">
                مشاهده محصولات
                <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              </button>
              <button onClick={() => onNavigate('journal')} className="btn-gold">
                مجله ورسا
                <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Slide indicators */}
      <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 gap-2.5">
        {HERO_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-500 ease-luxe ${
              i === index ? 'w-8 bg-gold-400' : 'w-3 bg-white/40 hover:bg-white/65'
            }`}
            aria-label={`اسلاید ${toFaDigits(i + 1)}`}
          />
        ))}
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 right-8 z-10 hidden items-center gap-2 text-gold-300/70 lg:flex">
        <span className="text-xs tracking-widest">اسکرول</span>
        <span className="h-10 w-px bg-gradient-to-b from-gold-400/60 to-transparent" />
      </div>
    </section>
  );
}
