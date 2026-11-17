import { RESTORED_IMAGE_FILES } from '@workspace/catalog';

// Classification only: delivery variants retain the selected product's own image.
const artworkFiles = new Set(RESTORED_IMAGE_FILES);

export function isBrandArtworkUrl(value: string, siteBase: string): boolean {
  try {
    const base = new URL(siteBase.endsWith('/') ? siteBase : `${siteBase}/`);
    const image = new URL(value, base);
    if (image.origin !== base.origin || image.username || image.password) return false;
    return [...artworkFiles].some(file => image.pathname === `${base.pathname}products/${file}`);
  } catch {
    return false;
  }
}

export const BRAND_IMAGE_WIDTHS = [160, 320, 640, 960, 1254] as const;

// Only delivery encodings of the exact approved local asset are derived.
// A query may select a newer/custom asset, so keep such URLs untouched.
export function brandArtworkSrcSet(value: string, siteBase: string): string | undefined {
  if (!isBrandArtworkUrl(value, siteBase)) return undefined;
  const base = siteBase.endsWith('/') ? siteBase : `${siteBase}/`;
  const source = new URL(value, base);
  if (source.search || source.hash) return undefined;
  return BRAND_IMAGE_WIDTHS.map(width => `${source.href.replace(/\.png$/, `-${width}.webp`)} ${width}w`).join(', ');
}
