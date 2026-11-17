import type { CatalogProduct } from '@workspace/catalog';
import { isGiftCategory } from './buying-guide';

export interface WeightChoice { weight: number; unit: string }
export interface WeightFilter { weight: string; unit: string }

// Aliases name the SAME unit; units of different size are never converted.
export function weightUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک');
  if (['g', 'gram', 'grams', 'گرم'].includes(normalized)) return 'گرم';
  if (['kg', 'kilogram', 'kilograms', 'کیلوگرم'].includes(normalized)) return 'کیلوگرم';
  if (['mg', 'milligram', 'milligrams', 'میلی‌گرم', 'میلی گرم'].includes(normalized)) return 'میلی‌گرم';
  if (['مثقال', 'mesghal'].includes(normalized)) return 'مثقال';
  return normalized;
}

export const weightChoiceKey = (choice: WeightChoice | WeightFilter) =>
  JSON.stringify([Number(choice.weight), weightUnit(choice.unit)]);

export function readShopWeight(search: string): WeightFilter | null {
  const params = new URLSearchParams(search);
  if (!params.has('weight') && !params.has('unit')) return null;
  // Keep invalid/removed selections explicit, rather than quietly showing all.
  return { weight: params.get('weight') ?? '', unit: params.get('unit') ?? '' };
}

export function validWeight(choice: WeightChoice | WeightFilter): boolean {
  return Number.isFinite(Number(choice.weight)) && Number(choice.weight) > 0 && !!choice.unit.trim();
}

export function matchesShopWeight(product: CatalogProduct, selected: WeightFilter | null): boolean {
  return selected === null || (validWeight(selected) && validWeight({ weight: product.weight, unit: product.weight_unit }) &&
    weightChoiceKey({ weight: product.weight, unit: product.weight_unit }) === weightChoiceKey(selected));
}

export function catalogWeightChoices(products: readonly CatalogProduct[]): WeightChoice[] {
  const choices = new Map<string, WeightChoice>();
  for (const product of products) {
    const choice = { weight: product.weight, unit: weightUnit(product.weight_unit) };
    if (validWeight(choice)) choices.set(weightChoiceKey(choice), choice);
  }
  return [...choices.values()].sort((a, b) => a.unit.localeCompare(b.unit, 'fa') || a.weight - b.weight);
}

export function shopWeightHref(choice: WeightChoice | null, search = ''): string {
  const params = new URLSearchParams(search);
  if (choice) { params.set('weight', String(choice.weight)); params.set('unit', weightUnit(choice.unit)); }
  else { params.delete('weight'); params.delete('unit'); }
  const query = params.toString();
  return `/shop${query ? `?${query}` : ''}`;
}

// This is the pack amount divided by its own recorded weight, not a discount,
// quality score or cross-unit conversion. Gift pack contents are not mass-priced.
export function productUnitPrice(product: CatalogProduct): { amount: number; unit: string } | null {
  const unit = weightUnit(product.weight_unit);
  if (isGiftCategory(product.category) || !['گرم', 'کیلوگرم', 'میلی‌گرم', 'مثقال'].includes(unit) ||
      !validWeight({ weight: product.weight, unit }) || !Number.isFinite(product.price) || product.price < 0) return null;
  const amount = product.price / product.weight;
  return Number.isFinite(amount) && amount <= Number.MAX_SAFE_INTEGER ? { amount, unit } : null;
}

export function categoryPackages(products: readonly CatalogProduct[], current: CatalogProduct): CatalogProduct[] {
  // Category membership is known. A variant/family relationship is not.
  return products.filter(product => product.category === current.category);
}
