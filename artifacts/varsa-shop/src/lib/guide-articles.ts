import { VARSA } from "./brand-identity";
import { cutStudy } from "./representative-products";
import { guidePath } from "./routes";
import type { Article, ProductCategory } from "./types";

interface GuideParagraph {
  text: string;
  heading?: string;
  source?: { url: string; label: string };
}

interface GuideContent {
  id: string;
  slug: string;
  title: string;
  sections: [GuideParagraph, ...GuideParagraph[]];
  relatedCategories: ProductCategory[];
}

const guides: GuideContent[] = [
  {
    id: "guide-brewing",
    slug: "brew-saffron",
    title: "روش دم کردن زعفران برای آشپزی",
    relatedCategories: ["پوشال", "نگین"],
    sections: [
      { text: "برای دم‌کردن زعفران، رشته‌ها را در هاون خشک کمی بسایید. مقدار کمی آب گرم اضافه کنید، روی ظرف را بپوشانید و چند دقیقه فرصت بدهید تا رنگ در آب پخش شود. مقدار زعفران را با دستور غذا و تعداد نفرات تنظیم کنید." },
      {
        heading: "آب جوش بریزم یا آب گرم؟",
        text: "آب گرم برای دم‌کردن کافی است. در یک پژوهش مقایسه‌ای، غلظت رنگدانه‌های زعفران پس از ۲۰ دقیقه در آب ۶۰ درجه، از نمونه‌های آبی با دمای بالاتر بیشتر بود. این نتیجه به شرایط همان آزمایش مربوط است.",
        source: { url: "https://doi.org/10.3390/molecules29133080", label: "پژوهش اثر دما و زمان دم‌کردن زعفران" },
      },
      {
        heading: "زعفران دم‌کرده را چه زمانی به برنج اضافه کنم؟",
        text: "برای روی دیس، بخشی از برنج پخته را جدا کنید، با مقدار کمی زعفران دم‌کرده مخلوط کنید و روی برنج بکشید. اگر دستور غذا مقدار مشخصی آب دارد، آب دم‌کردن را از همان مقدار بردارید.",
      },
    ],
  },
  {
    id: "guide-storage",
    slug: "store-saffron",
    title: "روش نگهداری زعفران خشک در خانه",
    relatedCategories: ["پوشال", "نگین", "سوپر نگین"],
    sections: [
      {
        text: "زعفران خشک را در ظرف تمیز و دربسته، در جای خشک و دور از نور نگه دارید. در یک پژوهش نگهداری، قدرت رنگ‌دهی نمونه‌ها در نور سریع‌تر از نمونه‌های نگهداری‌شده در تاریکی افت کرد.",
        source: { url: "https://air.unimi.it/bitstream/2434/935655/2/Saffron_Leoni%20et%20al.%202022.pdf", label: "پژوهش لئونی و همکاران دربارهٔ نگهداری زعفران" },
      },
      {
        heading: "بعد از باز کردن بسته، زعفران را آسیاب کنم؟",
        text: "می‌توانید رشته‌ها را کامل نگه دارید و فقط مقدار لازم برای همان غذا را بسایید. برای برداشتن رشته‌ها از قاشق یا هاون خشک استفاده کنید و در ظرف را دوباره ببندید.",
      },
      {
        heading: "زعفران تا چه زمانی قابل نگهداری است؟",
        text: "تاریخ و شرایط نگهداری را روی برچسب همان بسته بررسی کنید. اگر بستهٔ خریداری‌شده خیس یا آسیب‌دیده به دستتان رسیده، پیش از مصرف با فروشنده تماس بگیرید.",
      },
    ],
  },
  {
    id: "guide-authenticity",
    slug: "check-saffron",
    title: "پیش از خرید چگونه اصالت زعفران را بررسی کنیم؟",
    relatedCategories: ["پوشال", "نگین", "سوپر نگین"],
    sections: [
      { text: "نام فروشنده و اطلاعات روی بسته را بررسی کنید. اگر گزارش آزمایش ارائه شده، شناسهٔ محموله را روی بسته و گزارش تطبیق دهید. رنگ‌دهی در آب به‌تنهایی برای تأیید خلوص کافی نیست." },
      {
        heading: "آیا انتهای زرد رشته نشانهٔ تقلب است؟",
        text: "در برش پوشال ممکن است بخشی از خامهٔ روشن به رشتهٔ قرمز متصل بماند. در نگین رشته‌های کلاله معمولاً از هم جدا هستند. این ویژگی‌ها در تشخیص نوع برش کمک می‌کنند.",
        source: cutStudy,
      },
      {
        heading: "از روی گزارش آزمایش چه چیزی را بررسی کنم؟",
        text: "تاریخ، شناسهٔ نمونه و روش آزمون را بخوانید و بررسی کنید گزارش دقیقاً به کدام محموله مربوط است. ISO 3632-1 مشخصات زعفران خشک رشته‌ای، رشتهٔ برش‌خورده و پودری را پوشش می‌دهد.",
        source: { url: "https://www.iso.org/standard/86798.html", label: "استاندارد مشخصات زعفران ISO 3632-1:2025" },
      },
      {
        heading: "اگر به افزودنی مشکوک باشم چه کار کنم؟",
        text: "از آزمایشگاه بپرسید روش پیشنهادی چه ناخالصی‌هایی را می‌سنجد. برای نمونه، سند AOAC دامنهٔ روش‌های هدفمند برای بررسی افزودنی‌های مشخص در زعفران پودری را توضیح می‌دهد.",
        source: { url: "https://www.aoac.org/wp-content/uploads/2022/11/SMPR-2021_014.pdf", label: "سند AOAC برای آزمون هدفمند زعفران پودری" },
      },
    ],
  },
];

export const GUIDE_ARTICLES = guides.map(({ sections, ...guide }) => ({
  ...guide,
  sections,
  excerpt: sections[0].text,
  content: sections.map(({ heading, text }) => heading ? `## ${heading}\n\n${text}` : text).join("\n\n"),
  citationUrls: sections.flatMap(section => section.source ? [section.source.url] : []),
  image_url: "/photos/saffron-flowers-1600.webp",
  author: VARSA.name,
  category: "آشپزی و انتخاب زعفران",
  read_time: 2,
  created_at: "",
  path: guidePath(guide.slug),
})) satisfies Array<Article & Pick<GuideContent, "sections" | "relatedCategories"> & { path: string; citationUrls: string[] }>;
