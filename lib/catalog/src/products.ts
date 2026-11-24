export type ProductCategory = 'سوپر نگین' | 'نگین' | 'شبه نگین' | 'سرگل' | 'پوشال' | 'رشته' | 'هدیه';

export interface CatalogProduct {
  stock?: number | null;
  active?: boolean;
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  short_description: string;
  long_description: string | null;
  crocin: number;
  picrocrocin: number;
  safranal: number;
  weight: number;
  weight_unit: string;
  price: number;
  image_url: string;
  is_featured: boolean;
  sort_order: number;
}

export type StorefrontProduct = Omit<CatalogProduct, 'crocin' | 'picrocrocin' | 'safranal'>;

export class CatalogUnavailableError extends Error {
  constructor() {
    super('دریافت محصولات موقتاً امکان‌پذیر نیست. لطفاً دوباره تلاش کنید.');
  }
}

const COLUMNS = 'id,slug,name,category,short_description,long_description,crocin,picrocrocin,safranal,weight,weight_unit,price,image_url,is_featured,sort_order';

function validateStorefrontProduct(value: unknown): StorefrontProduct {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CatalogUnavailableError();
  const row = value as Record<string, unknown>;
  for (const key of ['id', 'slug', 'name', 'category', 'weight_unit', 'image_url']) {
    if (typeof row[key] !== 'string' || !row[key].trim()) throw new CatalogUnavailableError();
  }
  if (typeof row.short_description !== 'string' ||
      (row.long_description !== null && typeof row.long_description !== 'string') ||
      typeof row.is_featured !== 'boolean') throw new CatalogUnavailableError();
  for (const key of ['weight', 'price', 'sort_order']) {
    if (typeof row[key] !== 'number' || !Number.isFinite(row[key])) throw new CatalogUnavailableError();
  }
  if (!Number.isSafeInteger(row.price) || (row.price as number) < 0 || (row.price as number) > 2_147_483_647) {
    throw new CatalogUnavailableError();
  }
  return row as unknown as StorefrontProduct;
}

export function parseCatalogProduct(value: unknown): CatalogProduct {
  const product = validateStorefrontProduct(value) as CatalogProduct;
  if (![product.crocin, product.picrocrocin, product.safranal].every(Number.isFinite)) {
    throw new CatalogUnavailableError();
  }
  return product;
}

export function toStorefrontProduct(product: StorefrontProduct): StorefrontProduct {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    short_description: product.short_description,
    long_description: product.long_description,
    weight: product.weight,
    weight_unit: product.weight_unit,
    price: product.price,
    image_url: product.image_url,
    is_featured: product.is_featured,
    sort_order: product.sort_order,
    active: typeof product.active === 'boolean' ? product.active : undefined,
    stock: product.stock === null || (Number.isSafeInteger(product.stock) && product.stock! >= 0)
      ? product.stock
      : undefined,
  };
}

export function parseStorefrontProduct(value: unknown): StorefrontProduct {
  return toStorefrontProduct(validateStorefrontProduct(value));
}

// Both the storefront and checkout read the same public database view. Never
// silently replace a missing row, an empty catalog, or an outage with old prices.
export async function loadCatalogProducts(config: {
  url: string | undefined;
  anonKey: string | undefined;
  fetch?: typeof fetch;
}): Promise<CatalogProduct[]> {
  if (!config.url || !config.anonKey) throw new CatalogUnavailableError();
  try {
    const products: CatalogProduct[] = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const url = new URL(`${config.url.replace(/\/+$/, '')}/rest/v1/products`);
      url.searchParams.set('select', COLUMNS);
      url.searchParams.set('order', 'sort_order.asc,id.asc');
      url.searchParams.set('limit', String(pageSize));
      url.searchParams.set('offset', String(offset));
      const response = await (config.fetch ?? fetch)(url, {
        headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new CatalogUnavailableError();
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) throw new CatalogUnavailableError();
      products.push(...rows.map(parseCatalogProduct));
      if (rows.length < pageSize) break;
    }
    if (new Set(products.map((p) => p.id)).size !== products.length ||
        new Set(products.map((p) => p.slug)).size !== products.length) throw new CatalogUnavailableError();
    return products;
  } catch {
    throw new CatalogUnavailableError();
  }
}

// Compatibility for carts created before database IDs became authoritative.
// Resolve only against rows that still exist in the current database response.
export function resolveCatalogProduct<P extends StorefrontProduct>(products: readonly P[], id: string): P | undefined {
  const exact = products.find((product) => product.id === id);
  if (exact) return exact;
  if (id.startsWith('local-')) return products.find((product) => product.slug === id.slice(6));
  return undefined;
}

export function reconcileCart<T extends { product: StorefrontProduct; quantity: number }>(items: readonly T[], products: readonly StorefrontProduct[]) {
  const missingIds: string[] = [];
  let changed = false;
  const next = items.map((item) => {
    const product = resolveCatalogProduct(products, item.product.id);
    if (!product) { missingIds.push(item.product.id); return item; }
    if (JSON.stringify(product) !== JSON.stringify(item.product)) changed = true;
    return { ...item, product };
  });
  return { items: next, changed, missingIds };
}
