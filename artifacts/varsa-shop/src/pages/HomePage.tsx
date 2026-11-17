import { useReveal } from '@/lib/hooks';
import { Hero } from '@/components/home/Hero';
import { GuideTeaser } from '@/components/home/GuideTeaser';
import { Features } from '@/components/home/Features';
import { FeaturedProducts } from '@/components/home/FeaturedProducts';
import { SelectionShowcase } from '@/components/home/SelectionShowcase';
import { StoryPreview } from '@/components/home/StoryPreview';
import { JournalPreview } from '@/components/home/JournalPreview';
import { CtaBanner } from '@/components/home/CtaBanner';


export function HomePage() {
  const ref = useReveal<HTMLElement>();

  return (
    <main ref={ref} className="home-page">
      <Hero />
      <GuideTeaser />
      <Features />
      <FeaturedProducts />
      <SelectionShowcase />
      <StoryPreview />
      <JournalPreview />
      <CtaBanner />
    </main>
  );
}
