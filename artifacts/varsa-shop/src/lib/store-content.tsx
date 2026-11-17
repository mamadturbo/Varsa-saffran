import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { readStoreContent, type StoreContent } from "./management-api";
import { buildContactConfig } from "./contact-config";
import { CONTACT } from "./contacts";
import { SITE, formatPrice } from "./site";
const Context = createContext<StoreContent | null>(null);
export function StoreContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<StoreContent | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => {
      readStoreContent()
        .then((c) => {
          if (active) setContent(c);
        })
        .catch(() => {});
    };
    load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, []);
  return <Context.Provider value={content}>{children}</Context.Provider>;
}
export const useStoreContent = () => useContext(Context);
export function useStoreContact() {
  const content = useStoreContent();
  return content ? buildContactConfig(content.settings) : CONTACT;
}
export function useShippingInfo() {
  const s = useStoreContent()?.settings;
  return s?.shippingEnabled
    ? `هزینه ارسال ${formatPrice(s.shippingFee)}${s.freeShippingAbove ? `؛ ارسال رایگان برای خرید از ${formatPrice(s.freeShippingAbove)} پس از تخفیف` : ""}.`
    : SITE.shipping;
}
