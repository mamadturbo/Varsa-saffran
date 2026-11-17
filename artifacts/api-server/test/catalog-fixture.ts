import type { CatalogProduct } from '@workspace/catalog';
import { PRODUCT_VARIANTS, catalogProductId, catalogProductName } from './legacy-catalog';

// Preserve stage 1's historical prices as independent, isolated regression data.
export function legacyCatalogFixture(): CatalogProduct[] {
  return PRODUCT_VARIANTS.map((variant, index) => ({
    id: catalogProductId(variant), slug: variant.slug, name: catalogProductName(variant),
    category: variant.category, price: variant.price, image_url: `/products/${variant.image}`,
    short_description: 'fixture', long_description: null, crocin: 280, picrocrocin: 96,
    safranal: 50, weight: variant.weight, weight_unit: variant.weightUnit,
    is_featured: variant.featured, sort_order: index,
  }));
}
