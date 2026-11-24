import { useEffect, useRef } from "react";
import {
  metadataTags,
  type PageMeta,
} from "@/lib/page-meta";
import { pageMetadata } from "@/lib/public-page";
import { usePublicPage, useRawSearch } from "@/lib/page-context";
import { measureCommerce, measurePage } from "@/lib/analytics";
function apply(meta: PageMeta) {
  document.head
    .querySelectorAll("[data-varsa-meta]")
    .forEach((element) => element.remove());
  for (const item of metadataTags(meta)) {
    const element = document.createElement(item.tag);
    element.setAttribute("data-varsa-meta", "");
    for (const [key, value] of Object.entries(item.attrs ?? {}))
      element.setAttribute(key, value);
    if (item.text) element.textContent = item.text;
    document.head.append(element);
  }
}
export function DocumentMeta() {
  const { data, config, loading } = usePublicPage();
  const search = useRawSearch();
  const tracked = useRef<string | null>(null);
  const didView = useRef(false);
  useEffect(() => {
    if (loading) return;
    const meta = pageMetadata(data, config, search);
    apply(meta);
    if (config.indexable && meta.canonical && data.path !== tracked.current) {
      measurePage(meta.canonical, !didView.current);
      if (data.product) measureCommerce("view_item", [{ product: data.product, quantity: 1 }]);
      didView.current = true;
    }
    tracked.current = data.path;
  }, [data, config, loading, search]);
  return null;
}
