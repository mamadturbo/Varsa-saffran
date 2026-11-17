import type { Product } from '@/lib/types';
import { isGiftCategory } from '@/lib/buying-guide';
import { productUnitPrice } from '@/lib/product-comparison';
import { formatPrice } from '@/lib/site';

export function UnitPrice({ product }: { product: Product }) {
  const rate = productUnitPrice(product);
  return <p className="text-xs leading-6 text-cream-300">
    {rate ? `بهای هر ${rate.unit}: حدود ${formatPrice(rate.amount)}`
      : isGiftCategory(product.category) ? 'مبلغ پک شامل بسته‌بندی و محتویات آن است.'
        : 'بهای واحد وزن با مشخصات فعلی قابل محاسبه نیست.'}
  </p>;
}
