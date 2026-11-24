import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { CartItem, Product } from './types';
import { addCartItem, addToStoredCart, restoreCartState, updateCartQuantity, normalizeCartItems, type StoredCart } from './cart-state';
import { measureCommerce } from './analytics';
import { useLocation } from 'wouter';
import { useCustomer } from './customer';
import { CHECKOUT_PATHS } from './routes';

const STORAGE_KEY = 'varsa_cart_v1';

interface CartCtx {
  items: CartItem[];
  attemptId: string;
  count: number;
  total: number;
  add: (product: Product, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: (submitted?: Pick<StoredCart, 'attemptId' | 'items'>) => void;
  replaceItems: (items: CartItem[], previousItems: CartItem[]) => void;
}

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState(() => ({ version: 2 as const, attemptId: "", items: [] as CartItem[] }));
  const latestCart = useRef(cart);
  latestCart.current = cart;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setCart(restoreCartState(raw ? JSON.parse(raw) : null));
    } catch {
      setCart(restoreCartState(null));
    }
  }, []);
  const { items, attemptId } = cart;

  useEffect(() => {
    if (!cart.attemptId) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      /* ignore quota errors */
    }
  }, [cart]);

  const add = (product: Product, qty = 1) => {
    if (product.stock === 0 || product.active === false) return;
    const newAttemptId = crypto.randomUUID();
    const before = items.find(item => item.product.id === product.id)?.quantity ?? 0;
    const after = addCartItem(items, product, qty).find(item => item.product.id === product.id)?.quantity ?? 0;
    setCart((previous) => addToStoredCart(previous, product, qty, () => newAttemptId));
    if (after > before) measureCommerce("add_to_cart", [{ product, quantity: after - before }]);
  };

  const remove = (id: string) =>
    setCart((prev) => ({ ...prev, items: prev.items.filter((i) => i.product.id !== id) }));

  const setQty = (id: string, qty: number) =>
    setCart((prev) => ({ ...prev, items: updateCartQuantity(prev.items, id, qty) }));

  const clear: CartCtx['clear'] = (submitted) => {
    const current = latestCart.current;
    if (submitted && current.attemptId !== submitted.attemptId) return;
    // A shopper may edit the cart while an order response is in flight.
    // Keep those edits and give the edited cart a new checkout attempt.
    const next = submitted && current.items !== submitted.items
      ? { ...current, attemptId: crypto.randomUUID() }
      : { ...current, items: [] };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* unavailable storage */ }
    setCart(next);
  };
  const replaceItems = useCallback((next: CartItem[], previousItems: CartItem[]) => {
    setCart((prev) => prev.items === previousItems ? { ...prev, items: normalizeCartItems(next) } : prev);
  }, []);

  const count = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );
  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity * i.product.price, 0),
    [items]
  );

  const value: CartCtx = {
    items,
    attemptId,
    count,
    total,
    add,
    remove,
    setQty,
    clear,
    replaceItems,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export function useBuyProduct() {
  const { add } = useCart();
  const { ready, customer } = useCustomer();
  const [, navigate] = useLocation();

  return (product: Product) => {
    if (product.stock === 0 || product.active === false) return;
    add(product);
    navigate(ready && customer ? CHECKOUT_PATHS.cart : CHECKOUT_PATHS.register);
  };
}
