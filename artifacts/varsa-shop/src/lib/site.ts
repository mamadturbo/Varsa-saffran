export const CATEGORIES = ['همه', 'سوپر نگین', 'نگین', 'شبه نگین', 'پوشال'] as const;

export const SITE = {
  name: 'ورسا',
  tagline: 'دلگشای سفره‌های اصیل',
  mantra: 'از مزرعه تا سفره، با هنرِ کویر و عطرِ دلگشای ورسا.',
  phone: '۰۲۱-۹۱۰۰۲۰۳۰',
  phoneRaw: '02191002030',
  email: 'hello@varsa.ir',
  address: 'تهران، خیابان ولیعصر، برج هنر، طبقه‌ی هفتم',
  instagram: 'https://instagram.com',
  telegram: 'https://telegram.org',
  shipping: 'ارسال امن و سریع از طریق تیپاکس با بسته‌بندی ضربه‌گیر و ضدآسیب — تحویل ۲ تا ۵ روز کاری',
};

export const HERO_SLIDES = [
  {
    image: 'https://images.pexels.com/photos/33654800/pexels-photo-33654800.jpeg?auto=compress&cs=tinysrgb&h=1200&w=2000',
    eyebrow: 'زعفران نابِ کویر',
    title: 'ورسا؛ دلگشای سفره‌های اصیل',
    subtitle: 'زعفرانی ارگانیک از عمق کویر، بدون دخالت دست، برای لحظات ناب آشپزی شما',
  },
  {
    image: 'https://images.pexels.com/photos/10487658/pexels-photo-10487658.jpeg?auto=compress&cs=tinysrgb&h=1200&w=2000',
    eyebrow: 'بسته‌بندی فلزی اختصاصی',
    title: 'عطرِ کویر، در قفلی از هنر',
    subtitle: 'هر بسته، نگهبانِ عطر و کیفیتِ زعفران تا لحظه‌ی مصرف',
  },
  {
    image: 'https://images.pexels.com/photos/36698795/pexels-photo-36698795.jpeg?auto=compress&cs=tinysrgb&h=1200&w=2000',
    eyebrow: 'پک‌های هدیه‌ی ورسا',
    title: 'هدیه‌ای ماندگار، باارزش و اصیل',
    subtitle: 'برای مناسبت‌هایی که با عطر زعفران به یاد می‌مانند',
  },
];

export const STORY_IMAGES = {
  field: 'https://images.pexels.com/photos/19029722/pexels-photo-19029722.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
  flower: 'https://images.pexels.com/photos/34060195/pexels-photo-34060195.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
  harvest: 'https://images.pexels.com/photos/19029714/pexels-photo-19029714.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
  bloom: 'https://images.pexels.com/photos/14262714/pexels-photo-14262714.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
};

export const QUALITY_IMAGES = {
  threads: 'https://images.pexels.com/photos/33654800/pexels-photo-33654800.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
  spoon: 'https://images.pexels.com/photos/10487658/pexels-photo-10487658.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
};

export const GALLERY_IMAGE =
  'https://images.pexels.com/photos/36698795/pexels-photo-36698795.jpeg?auto=compress&cs=tinysrgb&h=1400&w=1400';

export const toFaDigits = (input: string | number): string =>
  String(input).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

export const formatPrice = (price: number): string => {
  const grouped = Math.round(price).toLocaleString('en-US');
  return `${toFaDigits(grouped)} تومان`;
};

export const formatWeight = (weight: number, unit: string): string =>
  `${toFaDigits(weight)} ${unit}`;
