import { parseCatalogProduct } from '@workspace/catalog';
import { MAX_PRODUCT_QUANTITY, MAX_ORDER_LINES } from '@workspace/validation';
import type { CartItem, Product } from './types';

export interface StoredCart {
  version: 2;
  attemptId: string;
  items: CartItem[];
}

export function restoreCartState(value: unknown, makeId = () => crypto.randomUUID()): StoredCart {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
  const attemptId = typeof record?.attemptId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.attemptId)
    ? record.attemptId : makeId();
  return { version: 2, attemptId, items: normalizeCartItems(Array.isArray(value) ? value : record?.items) };
}

export function addToStoredCart(state: StoredCart, product: Product, quantity = 1, makeId = () => crypto.randomUUID()): StoredCart {
  const items = addCartItem(state.items, product, quantity);
  return { version: 2, items, attemptId: state.items.length === 0 && items.length > 0 ? makeId() : state.attemptId };
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function addCartItem(items: CartItem[], product: Product, quantity = 1): CartItem[] {
  if (!positiveInteger(quantity)) return items;
  const existing = items.find((item) => item.product.id === product.id);
  if (existing) {
    return items.map((item) => item.product.id === product.id
      ? { product, quantity: Math.min(MAX_PRODUCT_QUANTITY, item.quantity + quantity) }
      : item);
  }
  if (items.length >= MAX_ORDER_LINES) return items;
  return [...items, { product, quantity: Math.min(MAX_PRODUCT_QUANTITY, quantity) }];
}

export function updateCartQuantity(items: CartItem[], id: string, quantity: number): CartItem[] {
  if (quantity === 0) return items.filter((item) => item.product.id !== id);
  if (!positiveInteger(quantity)) return items;
  return items.map((item) => item.product.id === id
    ? { ...item, quantity: Math.min(MAX_PRODUCT_QUANTITY, quantity) }
    : item);
}

// Local storage is untrusted and may contain old counts or duplicate rows.
export function normalizeCartItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  let items: CartItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || !positiveInteger(raw.quantity)) continue;
    try {
      const product = parseCatalogProduct(raw.product);
      items = addCartItem(items, product, raw.quantity);
    } catch {
      // A broken row must not prevent the rest of the cart from loading.
    }
  }
  return items;
}
