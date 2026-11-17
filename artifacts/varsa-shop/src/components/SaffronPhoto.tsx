import { DeliveryImage } from './DeliveryImage';
import { SAFFRON_PHOTOS } from '@/lib/saffron-photos';

export function SaffronPhoto({ photo, className = '', sizes = '100vw' }: {
  photo: typeof SAFFRON_PHOTOS[keyof typeof SAFFRON_PHOTOS];
  className?: string;
  sizes?: string;
}) {
  return <figure className={className}>
    <DeliveryImage {...photo} loading="lazy" sizes={sizes}
      className="aspect-square w-full rounded-2xl object-cover shadow-xl" />
  </figure>;
}
