import { DeliveryImage } from './DeliveryImage';

interface BrandArtworkProps {
  artwork: { src: string; alt: string; width: number; height: number };
  className?: string;
  priority?: boolean;
  sizes?: string;
}

export function BrandArtwork({ artwork, className = '', priority = false, sizes = '(min-width: 1280px) 568px, (min-width: 1024px) calc((100vw - 152px) / 2), (min-width: 640px) calc(100vw - 64px), calc(100vw - 48px)' }: BrandArtworkProps) {
  return (
    <figure className={className}>
      <DeliveryImage
        src={artwork.src}
        alt={artwork.alt}
        width={artwork.width}
        height={artwork.height}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className="aspect-square w-full rounded-2xl object-contain shadow-xl"
      />
      <figcaption className="mt-3 text-center text-xs leading-6 text-cream-400">
        تصویرسازی بسته‌بندی ورسا
      </figcaption>
    </figure>
  );
}
