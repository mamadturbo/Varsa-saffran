import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CartItem, Product } from './types';
import { addToStoredCart, restoreCartState, updateCartQuantity, normalizeCartItems } from './cart-state';

const STORAGE_KEY = 'varsa_cart_v1';

interface CartCtx {
  items: CartItem[];
  attemptId: string;
  count: number;
  total: number;
  add: (product: Product, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  replaceItems: (items: CartItem[]) => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return restoreCartState(raw ? JSON.parse(raw) : null);
    } catch {
      return restoreCartState(null);
    }
  });
  const { items, attemptId } = cart;
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      /* ignore quota errors */
    }
  }, [cart]);

  const add = (product: Product, qty = 1) => {
    if (product.stock === 0 || product.active === false) return;
    const newAttemptId = crypto.randomUUID();
    setCart((previous) => addToStoredCart(previous, product, qty, () => newAttemptId));
    setIsOpen(true);
  };

  const remove = (id: string) =>
    setCart((prev) => ({ ...prev, items: prev.items.filter((i) => i.product.id !== id) }));

  const setQty = (id: string, qty: number) =>
    setCart((prev) => ({ ...prev, items: updateCartQuantity(prev.items, id, qty) }));

  const clear = () => {
    // Persist the empty cart immediately before rendering success. A reload
    // between the response and React's next effect must not resurrect it.
    const empty = { ...cart, items: [] };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(empty)); } catch { /* unavailable storage */ }
    setCart(empty);
  };
  const replaceItems = useCallback((next: CartItem[]) => setCart((prev) => ({ ...prev, items: normalizeCartItems(next) })), []);

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
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
