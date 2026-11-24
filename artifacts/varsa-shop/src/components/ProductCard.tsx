import { productPath } from '@/lib/routes';
import { useAssetOrigin, useRawSearch } from '@/lib/page-context';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import type { Product } from '@/lib/types';
import { useBuyProduct } from '@/lib/cart';
import { formatPrice, formatWeight } from '@/lib/site';
import { isBrandArtworkUrl } from '@/lib/brand-artwork';
import { UnitPrice } from './UnitPrice';
import { rememberDialogTrigger } from '@/lib/dialog-focus';
import { DeliveryImage } from './DeliveryImage';
import { FavoriteButton } from './CustomerTools';

interface ProductCardProps {
  product: Product;
  headingLevel?: 2 | 3;
  imageSizes?: string;
}

export function ProductCard({ product, headingLevel = 3, imageSizes = '(min-width: 1280px) 276px, (min-width: 1024px) calc((100vw - 152px) / 3), (min-width: 640px) calc((100vw - 92px) / 2), calc(100vw - 32px)' }: ProductCardProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const buy = useBuyProduct();
  const search = useRawSearch();
  const origin = useAssetOrigin();
  const illustrated = isBrandArtworkUrl(product.image_url, `${origin}${import.meta.env.BASE_URL}`);

  return (
    <article className="card-luxe group flex h-full min-w-0 flex-col overflow-hidden">
      {/* Image */}
      <Link href={productPath(product.slug) + search}
        onClick={event => rememberDialogTrigger('product-dialog', event.currentTarget)}
        className="relative aspect-square overflow-hidden"
        aria-label={product.name}
      >
        <DeliveryImage
          src={product.image_url}
          alt={illustrated ? `تصویرسازی ${product.name}` : product.name}
          loading="lazy"
          sizes={imageSizes}
          crop="square"
          className={`h-full w-full ${illustrated ? 'object-contain' : 'object-cover'} transition-transform duration-[1200ms] ease-luxe group-hover:scale-110`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 via-transparent to-transparent" />
        <span className="absolute right-3 top-3 chip backdrop-blur-sm">
          {product.category}
        </span>
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <Heading className="text-base font-semibold leading-7 text-cream-50"><Link href={productPath(product.slug)}>{product.name}</Link></Heading>
        <p className="mt-2 line-clamp-2 text-sm leading-7 text-cream-300">
          {product.short_description}
        </p>

        {/* Specs */}
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-cream-400">
          <span className="rounded-md border border-gold-500/15 bg-gold-500/5 px-2 py-1">
            وزن: {formatWeight(product.weight, product.weight_unit)}
          </span>
        </div>

        <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2"><UnitPrice product={product} /><FavoriteButton productId={product.id}/></div>

        {/* Footer */}
        <div className="mt-auto pt-5">
          <div className="flex flex-col">
            <span className="text-[11px] text-cream-500">قیمت</span>
            <span className="text-base font-bold text-price">{formatPrice(product.price)}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href={productPath(product.slug) + search}
              onClick={event => rememberDialogTrigger('product-dialog', event.currentTarget)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-gold-500/40 px-3 py-2.5 text-xs font-medium text-accent transition-colors hover:border-gold-600 hover:bg-gold-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600"
              aria-label={`جزئیات ${product.name}`}
            >
              جزئیات
              <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            </Link>
            <button
              disabled={product.stock === 0 || product.active === false}
              onClick={() => buy(product)}
              className="btn-solid min-h-11 !px-3 !py-2.5 !text-xs"
            >
              {product.stock === 0 || product.active === false ? 'ناموجود' : 'خرید'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
