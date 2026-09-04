import type { Product } from '@/lib/types';
import { useReveal } from '@/lib/hooks';
import { Hero } from '@/components/home/Hero';
import { Features } from '@/components/home/Features';
import { FeaturedProducts } from '@/components/home/FeaturedProducts';
import { QualityShowcase } from '@/components/home/QualityShowcase';
import { StoryPreview } from '@/components/home/StoryPreview';
import { JournalPreview } from '@/components/home/JournalPreview';
import { CtaBanner } from '@/components/home/CtaBanner';

interface HomePageProps {
  onNavigate: (page: string) => void;
  onOpenProduct: (product: Product) => void;
  onOpenArticle: (slug: string) => void;
}

export function HomePage({ onNavigate, onOpenProduct, onOpenArticle }: HomePageProps) {
  const ref = useReveal<HTMLElement>();

  return (
    <main ref={ref}>
      <Hero onNavigate={onNavigate} />
      <Features />
      <FeaturedProducts onNavigate={onNavigate} onOpenProduct={onOpenProduct} />
      <QualityShowcase />
      <StoryPreview onNavigate={onNavigate} />
      <JournalPreview onNavigate={onNavigate} onOpenArticle={onOpenArticle} />
      <CtaBanner onNavigate={onNavigate} />
    </main>
  );
}
