import { categoryPath } from "./routes";

export function readShopCategory(search: string): string | null {
  return new URLSearchParams(search).get("category") || null;
}

export function shopCategoryHref(category: string | null, search = ""): string {
  const params = new URLSearchParams(search);
  if (category === null || category === "") params.delete("category");
  else params.set("category", category);
  const query = params.toString();
  return `/shop${query ? `?${query}` : ""}`;
}
export function shopListingHref(category: string | null, search = ""): string {
  const path = category && categoryPath(category);
  return path
    ? shopCategoryHref(null, search).replace("/shop", path)
    : shopCategoryHref(category, search);
}
