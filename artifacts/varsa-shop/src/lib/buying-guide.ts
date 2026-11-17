import type { CatalogProduct } from '@workspace/catalog';

export type GuideMode = 'types' | 'price' | 'gift';
export const GUIDE_MODES: { value: GuideMode; label: string }[] = [
  { value: 'types', label: 'شناخت دسته‌ها' },
  { value: 'price', label: 'شروع با هزینه کمتر' },
  { value: 'gift', label: 'انتخاب هدیه' },
];

export function readGuideMode(search: string): GuideMode {
  const mode = new URLSearchParams(search).get('mode');
  return mode === 'price' || mode === 'gift' ? mode : 'types';
}

export function guideModeHref(mode: GuideMode, search = ''): string {
  const params = new URLSearchParams(search);
  params.set('mode', mode);
  return `/guide?${params.toString()}`;
}

const normalizedCategory = (category: string) => category.trim().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک');
export const isGiftCategory = (category: string) => /(^|[\s\u200c-])هدیه($|[\s\u200c-])/.test(normalizedCategory(category));

export interface GuideGroup {
  category: string;
  count: number;
  minPrice: number;
  maxPrice: number;
  weights: { weight: number; unit: string }[];
  lowestPriceProduct: { name: string; price: number };
}

export function buildGuideGroups(products: readonly CatalogProduct[], mode: GuideMode): GuideGroup[] {
  const groups = new Map<string, GuideGroup>();
  for (const product of products) {
    if (mode === 'gift' && !isGiftCategory(product.category)) continue;
    let group = groups.get(product.category);
    if (!group) {
      group = {
        category: product.category, count: 0, minPrice: product.price, maxPrice: product.price,
        weights: [], lowestPriceProduct: { name: product.name, price: product.price },
      };
      groups.set(product.category, group);
    }
    group.count++;
    group.minPrice = Math.min(group.minPrice, product.price);
    group.maxPrice = Math.max(group.maxPrice, product.price);
    if (product.price < group.lowestPriceProduct.price) group.lowestPriceProduct = { name: product.name, price: product.price };
    const unit = product.weight_unit.trim();
    if (product.weight > 0 && unit && !group.weights.some(item => item.weight === product.weight && item.unit === unit)) {
      group.weights.push({ weight: product.weight, unit });
    }
  }
  const result = [...groups.values()];
  // Compare the amount payable for ONE pack, without inventing a unit conversion
  // or a quality ranking. Array sorting never changes the catalog's order.
  return mode === 'price' ? result.sort((a, b) => a.minPrice - b.minPrice) : result;
}

export function categoryGuide(category: string): { text: string; cut?: 'intact' | 'pieces' | 'style' } {
  switch (normalizedCategory(category)) {
    case 'نگین': return { cut: 'intact', text: 'بخش قرمز کلاله، بیشتر به‌صورت رشته‌های سالم و جدا از هم. اگر ظاهر رشته برایتان مهم است، شکل برش را در مشخصات محصول بررسی کنید.' };
    case 'سرگل': return { cut: 'pieces', text: 'بخش قرمز کلاله با قطعات کوتاه‌تر و شکستگی بیشتر نسبت به نگین. وزن و مبلغ هر بسته را کنار شکل برش مقایسه کنید.' };
    case 'پوشال': return { cut: 'style', text: 'بخش قرمز کلاله همراه با مقدار کوتاهی از خامهٔ زرد. برای انتخاب، توضیح شکل رشته و وزن همان محصول را بخوانید.' };
    default: return { text: isGiftCategory(category)
      ? 'برای هدیه، محتویات دقیق پک، تعداد بسته‌ها و وزن زعفران داخل آن را در جزئیات محصول بررسی کنید.'
      : 'توضیح، تصویر و وزن محصولات این دسته را بررسی کنید؛ از نام دسته به‌تنهایی درباره شکل برش یا کیفیت نتیجه نگیرید.' };
  }
}
