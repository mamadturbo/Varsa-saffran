import type { ImgHTMLAttributes } from 'react';
import { brandArtworkSrcSet } from '@/lib/brand-artwork';
import { realSaffronImage, saffronPhotoSrcSet } from '@/lib/saffron-photos';
import { pexelsCropSrcSet } from '@/lib/image-delivery';
import { useAssetOrigin } from '@/lib/page-context';

export function DeliveryImage({ src, sizes, crop, ...props }: ImgHTMLAttributes<HTMLImageElement> & { crop?: 'square' | 'landscape' }) {
  const origin = useAssetOrigin();
  src = src && realSaffronImage(src);
  const sources = src && (brandArtworkSrcSet(src, `${origin}${import.meta.env.BASE_URL}`) ?? saffronPhotoSrcSet(src));
  const remoteSources = src && crop ? pexelsCropSrcSet(src, crop) : undefined;
  // Invalidate the undersized first release while preserving custom image queries.
  const version = (value: string) => {
    try {
      const url = new URL(value, origin);
      if (url.origin !== origin || url.search || url.hash ||
        !['photos/', 'products/'].some(folder => url.pathname.startsWith(`${import.meta.env.BASE_URL}${folder}`))) return value;
      url.searchParams.set('v', 'original-20261115');
      return url.pathname + url.search;
    } catch {
      return value;
    }
  };
  const deliveredSources = sources?.split(', ').map(entry => {
    const [url, width] = entry.split(' ');
    return `${version(url)} ${width}`;
  }).join(', ');
  const image = <img {...props} src={src && version(src)} srcSet={remoteSources} sizes={remoteSources ? sizes : undefined} decoding="async" />;
  return sources ? (
    <picture className="contents">
      <source type="image/webp" srcSet={deliveredSources} sizes={sizes ?? '100vw'} />
      {image}
    </picture>
  ) : image;
}
