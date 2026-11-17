// Historical prices used only by isolated regression tests.
export type CatalogVariant = {
  slug: string;
  category: 'سوپر نگین' | 'نگین' | 'شبه نگین' | 'پوشال';
  label: string;
  weight: number;
  weightUnit: string;
  price: number;
  image: string;
  featured: boolean;
};

// Not imported by the storefront or production API.
export const PRODUCT_VARIANTS: readonly Readonly<CatalogVariant>[] = Object.freeze([
  { slug: 'super-negin-1g', category: 'سوپر نگین', label: '۱ گرمی', weight: 1, weightUnit: 'گرم', price: 449000, image: 'super-negin-1g.png', featured: true },
  { slug: 'super-negin-2g', category: 'سوپر نگین', label: '۲ گرمی', weight: 2, weightUnit: 'گرم', price: 849000, image: 'super-negin-2g.png', featured: false },
  { slug: 'super-negin-1-mesghal', category: 'سوپر نگین', label: '۱ مثقالی', weight: 1, weightUnit: 'مثقال', price: 1949000, image: 'super-negin-1-mesghal.png', featured: false },
  { slug: 'negin-1g', category: 'نگین', label: '۱ گرمی', weight: 1, weightUnit: 'گرم', price: 429000, image: 'negin-1g.png', featured: true },
  { slug: 'negin-2g', category: 'نگین', label: '۲ گرمی', weight: 2, weightUnit: 'گرم', price: 819000, image: 'negin-2g.png', featured: false },
  { slug: 'negin-1-mesghal', category: 'نگین', label: '۱ مثقالی', weight: 1, weightUnit: 'مثقال', price: 1879000, image: 'negin-1-mesghal.png', featured: false },
  { slug: 'shabeh-negin-1g', category: 'شبه نگین', label: '۱ گرمی', weight: 1, weightUnit: 'گرم', price: 408000, image: 'shabeh-negin-1g.png', featured: true },
  { slug: 'shabeh-negin-2g', category: 'شبه نگین', label: '۲ گرمی', weight: 2, weightUnit: 'گرم', price: 779000, image: 'shabeh-negin-2g.png', featured: false },
  { slug: 'shabeh-negin-1-mesghal', category: 'شبه نگین', label: '۱ مثقالی', weight: 1, weightUnit: 'مثقال', price: 1789000, image: 'shabeh-negin-1-mesghal.png', featured: false },
  { slug: 'poshal-1g', category: 'پوشال', label: '۱ گرمی', weight: 1, weightUnit: 'گرم', price: 379000, image: 'poshal-1g.png', featured: true },
  { slug: 'poshal-2g', category: 'پوشال', label: '۲ گرمی', weight: 2, weightUnit: 'گرم', price: 719000, image: 'poshal-2g.png', featured: false },
  { slug: 'poshal-1-mesghal', category: 'پوشال', label: '۱ مثقالی', weight: 1, weightUnit: 'مثقال', price: 1649000, image: 'poshal-1-mesghal.png', featured: false },
].map((variant) => Object.freeze(variant as CatalogVariant)));

export function catalogProductId(variant: Readonly<CatalogVariant>): string {
  return `local-${variant.slug}`;
}

export function catalogProductName(variant: Readonly<CatalogVariant>): string {
  return `زعفران ${variant.category} ورسا ${variant.label}`;
}

export function findCatalogProduct(id: string): Readonly<CatalogVariant> | undefined {
  return PRODUCT_VARIANTS.find((variant) => catalogProductId(variant) === id);
}
