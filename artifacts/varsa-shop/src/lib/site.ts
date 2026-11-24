import { SAFFRON_PHOTOS } from './saffron-photos';
import { VARSA } from './brand-identity';

export const CATEGORIES = ['همه', 'سوپر نگین', 'نگین', 'شبه نگین', 'پوشال'] as const;

export const SITE = {
  name: VARSA.shortName,
  tagline: 'دلگشای سفره‌های اصیل',
  mantra: 'عطر زعفران ورسا، از آشپزخانه تا سفرهٔ مهمانی.',
  shipping: 'هزینهٔ ارسال در جمع کالاها محاسبه نمی‌شود. پیش از پرداخت دربارهٔ هزینه و زمان ارسال با پشتیبانی هماهنگ کنید.',
};

// Existing project artwork, not documentary photography of the farm or goods.
export const BRAND_ARTWORK = {
  negin1g: {
    src: `${import.meta.env.BASE_URL}products/negin-1g.png`,
    alt: 'تصویرسازی بسته فلزی زعفران نگین ورسا، یک گرمی',
    width: 1254,
    height: 1254,
  },
  negin2g: {
    src: `${import.meta.env.BASE_URL}products/negin-2g.png`,
    alt: 'تصویرسازی بسته فلزی زعفران نگین ورسا، دو گرمی',
    width: 1254,
    height: 1254,
  },
  poshal2g: {
    src: `${import.meta.env.BASE_URL}products/poshal-2g.png`,
    alt: 'تصویرسازی بسته فلزی زعفران پوشال ورسا، دو گرمی',
    width: 1254,
    height: 1254,
  },
} as const;

export const HERO_SLIDES = [
  {
    image: SAFFRON_PHOTOS.flowers.src,
    eyebrow: 'زعفران ورسا',
    title: 'ورسا؛ دلگشای سفره‌های اصیل',
    subtitle: 'زعفران را برای آشپزی یا هدیه انتخاب کنید؛ وزن، مشخصات و قیمت بسته‌ها را در فروشگاه ببینید.',
  },
  {
    image: SAFFRON_PHOTOS.spoon.src,
    eyebrow: 'طرح بسته‌بندی ورسا',
    title: 'عطرِ کویر، در قفلی از هنر',
    subtitle: 'با طرح بسته‌بندی ورسا آشنا شوید و مشخصات هر بسته را در صفحه محصول بخوانید.',
  },
  {
    image: SAFFRON_PHOTOS.field.src,
    eyebrow: 'انتخاب زعفران برای هدیه',
    title: 'هدیه‌ای ماندگار، باارزش و اصیل',
    subtitle: 'برای مناسبت‌هایی که با عطر زعفران به یاد می‌مانند',
  },
];

export const toFaDigits = (input: string | number): string =>
  String(input).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

export const formatPrice = (price: number): string => {
  const grouped = Math.round(price).toLocaleString('en-US');
  return `${toFaDigits(grouped)} تومان`;
};

export const formatWeight = (weight: number, unit: string): string =>
  `${toFaDigits(weight)} ${unit}`;
