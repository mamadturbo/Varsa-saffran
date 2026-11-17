export const PAGE_PATHS = {
  home: "/",
  shop: "/shop",
  guide: "/guide",
  journal: "/journal",
  about: "/about",
  contact: "/contact",
  admin: "/admin",
} as const;
export function pagePath(page: string): string {
  return Object.hasOwn(PAGE_PATHS, page)
    ? PAGE_PATHS[page as keyof typeof PAGE_PATHS]
    : "/not-found";
}
export const articlePath = (slug: string) =>
  `/journal/${encodeURIComponent(slug)}`;
export const productPath = (slug: string) =>
  `/products/${encodeURIComponent(slug)}`;
// The router decodes URI characters for matching. Read the raw segment and
// decode exactly once so literal percent signs and reserved characters survive.
export function lastPathSegment(pathname: string): string | null {
  const encoded = pathname.replace(/\/+$/, "").split("/").at(-1);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}
