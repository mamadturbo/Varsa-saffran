import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  buildPageMeta,
  metadataTags,
  relativeMetaPath,
  type PageMeta,
} from "@/lib/page-meta";
import { resolvePageMeta } from "@/lib/meta-data";
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
  const [path] = useLocation();
  useEffect(() => {
    let active = true;
    const config = {
      catalogSource: 'managed' as const,
      apiUrl: window.location.origin,
      siteUrl: import.meta.env.VITE_SITE_URL || window.location.origin,
      basePath: import.meta.env.BASE_URL,
    };
    const rawPath = relativeMetaPath(window.location.pathname, config.basePath);
    apply(buildPageMeta(rawPath, config));
    resolvePageMeta(rawPath, config).then((meta) => {
      if (active) apply(meta);
    });
    return () => {
      active = false;
    };
  }, [path]);
  return null;
}
