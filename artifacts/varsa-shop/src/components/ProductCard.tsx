import { Plus, Star } from 'lucide-react';
import type { Product } from '@/lib/types';
import { useCart } from '@/lib/cart';
import { formatPrice, formatWeight, toFaDigits } from '@/lib/site';

interface ProductCardProps {
  product: Product;
  onOpen: (product: Product) => void;
}

export function ProductCard({ product, onOpen }: ProductCardProps) {
  const { add } = useCart();

  return (
    <article className="card-luxe group flex flex-col overflow-hidden">
      {/* Image */}
      <button
        onClick={() => onOpen(product)}
        className="relative aspect-square overflow-hidden"
        aria-label={product.name}
      >
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-[1200ms] ease-luxe group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 via-transparent to-transparent" />
        <span className="absolute right-3 top-3 chip backdrop-blur-sm">
          {product.category}
        </span>
        {product.crocin >= 260 && (
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-gold-400/50 bg-ink-950/60 px-2.5 py-1 text-[10px] font-medium text-gold-200 backdrop-blur-sm">
            <Star className="h-3 w-3 fill-gold-400 text-gold-400" />
            درجه‌ی S
          </span>
        )}
      </button>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-semibold leading-7 text-cream-50">{product.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-7 text-cream-300">
          {product.short_description}
        </p>

        {/* Specs */}
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-cream-400">
          <span className="rounded-md border border-gold-500/15 bg-gold-500/5 px-2 py-1">
            کروسین: {toFaDigits(product.crocin)}
          </span>
          <span className="rounded-md border border-gold-500/15 bg-gold-500/5 px-2 py-1">
            وزن: {formatWeight(product.weight, product.weight_unit)}
          </span>
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <div className="flex flex-col">
            <span className="text-[11px] text-cream-500">قیمت</span>
            <span className="text-base font-bold text-gold-200">{formatPrice(product.price)}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onOpen(product)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-500/25 text-gold-200 transition-all duration-500 ease-luxe hover:border-gold-400 hover:bg-gold-500/10"
              aria-label="جزئیات محصول"
            >
              <Plus className="h-4 w-4 rotate-45" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => add(product)}
              className="btn-solid !px-4 !py-2.5 !text-xs"
            >
              افزودن
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
