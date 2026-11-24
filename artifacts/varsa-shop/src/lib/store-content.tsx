import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { browserPublicApi, type PublicStore } from "./public-page";
import { usePublicPage } from "./page-context";
import { storeContact } from "./contacts";
import { SITE, formatPrice } from "./site";
const Context = createContext<PublicStore | null>(null);
export function StoreContentProvider({ children }: { children: ReactNode }) {
  const { data } = usePublicPage();
  const [refreshed, setRefreshed] = useState<{ page: typeof data; content: PublicStore }>();
  useEffect(() => {
    let active = true;
    const load = () => {
      browserPublicApi.store()
        .then((c) => {
          if (active) setRefreshed({ page: data, content: c });
        })
        .catch(() => {});
    };
    if (data.path === "/account" || data.path.startsWith("/payment/") || data.path.startsWith("/checkout/")) load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, [data]);
  return <Context.Provider value={(refreshed?.page === data ? refreshed.content : data.store) ?? null}>{children}</Context.Provider>;
}
export const useStoreContent = () => useContext(Context);
export function useStoreContact() {
  return storeContact(useStoreContent()?.settings);
}
export function useShippingInfo() {
  const s = useStoreContent()?.settings;
  return s?.shippingEnabled
    ? `هزینه ارسال ${formatPrice(s.shippingFee)}${s.freeShippingAbove ? `؛ ارسال رایگان برای خرید از ${formatPrice(s.freeShippingAbove)} پس از تخفیف` : ""}.`
    : SITE.shipping;
}
