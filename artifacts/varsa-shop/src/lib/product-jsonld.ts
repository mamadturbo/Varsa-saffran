import type { StorefrontProduct as CatalogProduct } from "@workspace/catalog";
import { VARSA } from "./brand-identity";

export interface ProductJsonLd {
  "@context": "https://schema.org";
  "@type": "Product";
  "@id"?: string;
  name: string;
  description: string;
  sku: string;
  category: string;
  brand: { "@type": "Brand"; name: string; alternateName: string[] };
  url?: string;
  image?: string[];
  weight?: { "@type": "QuantitativeValue"; value: number; unitText: string };
  offers: {
    "@type": "Offer";
    price: string;
    priceCurrency: "IRR";
    availability?: "https://schema.org/InStock" | "https://schema.org/OutOfStock";
    url?: string;
    seller?: { "@id": string; "@type": "Organization"; name: string };
  };
}

export function buildProductJsonLd(
  product: CatalogProduct,
  page: { url?: string; image?: string; description: string; sellerId?: string },
): ProductJsonLd | undefined {
  // Catalog and checkout amounts use conventional toman. This conversion is
  // limited to schema.org's ISO-currency price; cart/order values stay unchanged.
  if (
    !Number.isSafeInteger(product.price) ||
    product.price < 0 ||
    product.price > 2_147_483_647 ||
    !product.id?.trim() ||
    !product.name?.trim()
  )
    return undefined;
  const result: ProductJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name.trim(),
    description: page.description,
    sku: product.id,
    category: product.category,
    brand: { "@type": "Brand", name: VARSA.name, alternateName: [VARSA.englishName, VARSA.shortName] },
    offers: {
      "@type": "Offer",
      price: String(product.price * 10),
      priceCurrency: "IRR",
    },
  };
  if (page.url) {
    result.url = page.url;
    result["@id"] = `${page.url}#product`;
    result.offers.url = page.url;
  }
  if (page.image) result.image = [page.image];
  if (page.sellerId) {
    result.offers.seller = { "@id": page.sellerId, "@type": "Organization", name: VARSA.name };
  }
  const massUnits = new Set(["گرم", "کیلوگرم", "مثقال", "g", "kg"]);
  if (
    Number.isFinite(product.weight) &&
    product.weight > 0 &&
    massUnits.has(product.weight_unit)
  )
    result.weight = {
      "@type": "QuantitativeValue",
      value: product.weight,
      unitText: product.weight_unit,
    };
  if (Number.isSafeInteger(product.stock) && product.stock! >= 0)
    result.offers.availability = product.stock === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock";
  return result;
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}
