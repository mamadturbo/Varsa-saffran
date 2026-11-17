import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Customer } from "@workspace/catalog";
import { customerRequest, getCustomer } from "./customer-api";
const KEY = "varsa_guest_favorites_v1";
function readGuest(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((v) => typeof v === "string").slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
interface AccountContext {
  customer: Customer | null;
  ready: boolean;
  error: string;
  favoriteIds: string[];
  favoriteBusy: boolean;
  acceptCustomer: (c: Customer) => Promise<void>;
  updateCustomer: (c: Customer) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
}
const Context = createContext<AccountContext | null>(null);
export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [guest, setGuest] = useState(readGuest),
    [favoriteBusy, setFavoriteBusy] = useState(false);
  const lock = useRef(false);
  const refresh = async () => {
    setError("");
    try {
      setCustomer((await getCustomer()).customer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "دریافت حساب انجام نشد.");
    } finally {
      setReady(true);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const acceptCustomer = async (c: Customer) => {
    setCustomer(c);
    setError("");
    if (guest.length) {
      const ids = [...new Set([...c.profile.favorites, ...guest])].slice(
        0,
        100,
      );
      const result = await customerRequest<{ customer: Customer }>(
        "/customer/favorites",
        "PUT",
        { ids },
      );
      setCustomer(result.customer);
      setGuest([]);
      try {
        localStorage.removeItem(KEY);
      } catch {}
    }
  };
  const toggleFavorite = async (id: string) => {
    if (lock.current) return;
    lock.current = true;
    setFavoriteBusy(true);
    try {
      const current = customer?.profile.favorites ?? guest;
      const ids = current.includes(id)
        ? current.filter((v) => v !== id)
        : [...current, id];
      if (ids.length > 100)
        throw new Error("حداکثر صد محصول در علاقه‌مندی‌ها قابل ذخیره است.");
      if (customer) {
        const r = await customerRequest<{ customer: Customer }>(
          "/customer/favorites",
          "PUT",
          { ids },
        );
        setCustomer(r.customer);
      } else {
        setGuest(ids);
        try {
          localStorage.setItem(KEY, JSON.stringify(ids));
        } catch {
          throw new Error("ذخیره علاقه‌مندی‌ها در مرورگر انجام نشد.");
        }
      }
    } finally {
      lock.current = false;
      setFavoriteBusy(false);
    }
  };
  const logout = async () => {
    await customerRequest("/customer/auth/logout", "POST");
    setCustomer(null);
  };
  return (
    <Context.Provider
      value={{
        customer,
        ready,
        error,
        favoriteIds: customer?.profile.favorites ?? guest,
        favoriteBusy,
        acceptCustomer,
        updateCustomer: setCustomer,
        refresh,
        logout,
        toggleFavorite,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCustomer() {
  const c = useContext(Context);
  if (!c) throw new Error("CustomerProvider missing");
  return c;
}
