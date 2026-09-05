import type { Product, ProductCategory } from './types';

type LocalVariant = {
  slug: string;
  category: Exclude<ProductCategory, 'سرگل' | 'رشته' | 'هدیه'>;
  label: string;
  weight: number;
  weightUnit: string;
  price: number;
  image: string;
  featured: boolean;
};

const productAsset = (fileName: string) =>
  `${import.meta.env.BASE_URL}products/${fileName}`;

const categorySpecs: Record<LocalVariant['category'], {
  crocin: number;
  picrocrocin: number;
  safranal: number;
  description: string;
}> = {
  'سوپر نگین': {
    crocin: 280,
    picrocrocin: 96,
    safranal: 50,
    description: 'ممتازترین رشته‌های قرمز با رنگ‌دهی بالا و عطری ماندگار',
  },
  نگین: {
    crocin: 268,
    picrocrocin: 92,
    safranal: 46,
    description: 'کلاله‌های بلند و تماماً قرمز با رنگ و عطر اصیل',
  },
  'شبه نگین': {
    crocin: 255,
    picrocrocin: 88,
    safranal: 44,
    description: 'زعفرانی خوش‌رنگ و خوش‌عطر برای مصرف روزانه',
  },
  پوشال: {
    crocin: 240,
    picrocrocin: 84,
    safranal: 42,
    description: 'زعفران طبیعی با عطر گرم و رنگ‌دهی دلنشین',
  },
};

const variants: LocalVariant[] = [
  { slug: 'super-negin-1g', category: 'سوپر نگین', label: '۱ گرمی', weight: 1, weightUnit: 'گرم', price: 449000, image: productAsset('super-negin-1g.png'), featured: true },
  { slug: 'super-negin-2g', category: 'سوپر نگین', label: '۲ گرمی', weight: 2, weightUnit: 'گرم', price: 849000, image: productAsset('super-negin-2g.png'), featured: false },
  { slug: 'super-negin-1-mesghal', category: 'سوپر نگین', label: '۱ مثقالی', weight: 1, weightUnit: 'مثقال', price: 1949000, image: productAsset('super-negin-1-mesghal.png'), featured: false },
  { slug: 'negin-1g', category: 'نگین', label: '۱ گرمی', weight: 1, weightUnit: 'گرم', price: 429000, image: productAsset('negin-1g.png'), featured: true },
  { slug: 'negin-2g', category: 'نگین', label: '۲ گرمی', weight: 2, weightUnit: 'گرم', price: 819000, image: productAsset('negin-2g.png'), featured: false },
  { slug: 'negin-1-mesghal', category: 'نگین', label: '۱ مثقالی', weight: 1, weightUnit: 'مثقال', price: 1879000, image: productAsset('negin-1-mesghal.png'), featured: false },
  { slug: 'shabeh-negin-1g', category: 'شبه نگین', label: '۱ گرمی', weight: 1, weightUnit: 'گرم', price: 408000, image: productAsset('shabeh-negin-1g.png'), featured: true },
  { slug: 'shabeh-negin-2g', category: 'شبه نگین', label: '۲ گرمی', weight: 2, weightUnit: 'گرم', price: 779000, image: productAsset('shabeh-negin-2g.png'), featured: false },
  { slug: 'shabeh-negin-1-mesghal', category: 'شبه نگین', label: '۱ مثقالی', weight: 1, weightUnit: 'مثقال', price: 1789000, image: productAsset('shabeh-negin-1-mesghal.png'), featured: false },
  { slug: 'poshal-1g', category: 'پوشال', label: '۱ گرمی', weight: 1, weightUnit: 'گرم', price: 379000, image: productAsset('poshal-1g.png'), featured: true },
  { slug: 'poshal-2g', category: 'پوشال', label: '۲ گرمی', weight: 2, weightUnit: 'گرم', price: 719000, image: productAsset('poshal-2g.png'), featured: false },
  { slug: 'poshal-1-mesghal', category: 'پوشال', label: '۱ مثقالی', weight: 1, weightUnit: 'مثقال', price: 1649000, image: productAsset('poshal-1-mesghal.png'), featured: false },
];

export const LOCAL_PRODUCTS: Product[] = variants.map((variant, index) => {
  const specs = categorySpecs[variant.category];

  return {
    id: `local-${variant.slug}`,
    slug: variant.slug,
    name: `زعفران ${variant.category} ورسا ${variant.label}`,
    category: variant.category,
    short_description: `${specs.description}؛ مناسب برای آشپزی، پذیرایی و هدیه.`,
    long_description: `این محصول از ${variant.category} اصیل ورسا با رشته‌های خوش‌رنگ و خوش‌عطر تهیه شده است. بسته‌بندی فلزی اختصاصی ورسا عطر و کیفیت زعفران را تا لحظه‌ی مصرف حفظ می‌کند.`,
    crocin: specs.crocin,
    picrocrocin: specs.picrocrocin,
    safranal: specs.safranal,
    weight: variant.weight,
    weight_unit: variant.weightUnit,
    price: variant.price,
    image_url: variant.image,
    is_featured: variant.featured,
    sort_order: index + 1,
  };
});