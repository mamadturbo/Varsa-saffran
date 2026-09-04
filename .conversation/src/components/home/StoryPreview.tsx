import { ArrowLeft, Quote } from 'lucide-react';
import { STORY_IMAGES } from '@/lib/site';
import { SectionHeading } from '@/components/SectionHeading';

interface StoryPreviewProps {
  onNavigate: (page: string) => void;
}

export function StoryPreview({ onNavigate }: StoryPreviewProps) {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="container-luxe">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Images */}
          <div className="reveal relative">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <img
                  src={STORY_IMAGES.field}
                  alt="مزرعه‌ی زعفران"
                  loading="lazy"
                  className="aspect-[3/4] w-full rounded-2xl object-cover"
                />
                <img
                  src={STORY_IMAGES.bloom}
                  alt="گل زعفران"
                  loading="lazy"
                  className="aspect-square w-full rounded-2xl object-cover"
                />
              </div>
              <div className="space-y-4 pt-10">
                <img
                  src={STORY_IMAGES.flower}
                  alt="گلچه‌ی زعفران"
                  loading="lazy"
                  className="aspect-square w-full rounded-2xl object-cover"
                />
                <img
                  src={STORY_IMAGES.harvest}
                  alt="برداشت زعفران"
                  loading="lazy"
                  className="aspect-[3/4] w-full rounded-2xl object-cover"
                />
              </div>
            </div>
            <div className="pointer-events-none absolute -inset-6 -z-10 rounded-full bg-gold-500/10 blur-3xl" />
          </div>

          {/* Text */}
          <div>
            <SectionHeading
              center={false}
              eyebrow="داستان ورسا"
              title={<>«ور» سینه و دل، «سا» <span className="gold-text">گشاینده</span></>}
              subtitle="ورسا، نامی از دلِ زبان فارسی؛ ترکیبی که روی هم «دلگشا» معنی می‌دهد. این برند، زعفرانی اصیل از دل کویر ایران را با هویتی هنری و مجلل به خانه‌ها و رستوران‌های ایران زمین می‌آورد."
            />

            <div className="reveal reveal-delay-3 mt-8 rounded-2xl border border-gold-500/20 bg-gradient-to-b from-gold-500/[0.06] to-transparent p-6">
              <Quote className="h-6 w-6 text-gold-400/70" strokeWidth={1.2} />
              <p className="mt-3 text-base leading-8 text-cream-200 text-pretty">
                ما به خاکِ ایران عشق می‌ورزیم و هر گل زعفران را ارج می‌نهیم. از مزرعه‌ی
                ارگانیک در دلِ کویر تا بسته‌بندی فلزیِ اختصاصی، با هیچ دستی جز هنرِ
                طبیعت، عطر زعفران را به سفره‌ی شما نمی‌رسانیم.
              </p>
            </div>

            <button
              onClick={() => onNavigate('about')}
              className="reveal reveal-delay-4 btn-gold mt-8"
            >
              خواندن داستان کامل
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
