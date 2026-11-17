// Documentary photographs; provenance and reuse terms: docs/saffron-photos.md.
const photo = (name: string, alt: string, width = 2000, height = 1333) => ({
  src: `${import.meta.env.BASE_URL}photos/saffron-${name}-1600.webp`,
  alt, width: Math.min(width, 1600), height: Math.round(height * Math.min(width, 1600) / width),
});

const farmCredit = { label: 'عکس: صفا دانشور · CC BY-SA 3.0', href: `${import.meta.env.BASE_URL}photos/saffron-farm-series-license.txt` };

export const SAFFRON_PHOTOS = {
  torbatFlowers: { ...photo('torbat-flowers', 'گل‌های زعفران در خاک مزرعه تربت حیدریه با نور گرم غروب', 2100, 1400), credit: farmCredit },
  torbatPicking: { ...photo('torbat-picking', 'برداشت گل زعفران با سبد حصیری در تربت حیدریه', 2100, 1400), credit: farmCredit },
  flowers: photo('flowers', 'گل‌های واقعی زعفران با کلاله‌های قرمز در مزرعه'),
  field: { ...photo('field-torbat', 'مزرعه گل‌های زعفران در تربت حیدریه هنگام غروب', 2100, 1400), credit: farmCredit },
  harvest: photo('harvest', 'برداشت دستی گل زعفران در مزرعه‌ای در هرات'),
  threads: photo('threads', 'نمای نزدیک رشته‌های خشک زعفران ایرانی', 1613, 1545),
  spoon: photo('spoon', 'رشته‌های واقعی زعفران در قاشق چوبی'),
} as const;

// Replace only the old stock selections, including saved CMS banners/articles.
// Custom uploads and other remote images remain under the owner's control.
export function realSaffronImage(src: string): string {
  try {
    const url = new URL(src);
    if (url.hostname !== 'images.pexels.com') return src;
    const id = url.pathname.split('/')[2];
    const replacements: Record<string, string> = {
      '33654800': SAFFRON_PHOTOS.flowers.src,
      '10487658': SAFFRON_PHOTOS.spoon.src,
      '36698795': SAFFRON_PHOTOS.harvest.src,
      '6707417': SAFFRON_PHOTOS.threads.src,
      '8330324': SAFFRON_PHOTOS.spoon.src,
    };
    return replacements[id] ?? src;
  } catch { return src; }
}

export function saffronPhotoSrcSet(src: string): string | undefined {
  const match = Object.entries(SAFFRON_PHOTOS).find(([, p]) => p.src === src);
  if (!match) return undefined;
  const maxWidth = match[0] === 'threads' ? 1600 : 2000;
  return [480, 960, 1600, 2000].filter(w => w <= maxWidth)
    .map(w => `${src.replace('-1600.webp', `-${w}.webp`)} ${w}w`).join(', ');
}
