# گزارش پیاده‌سازی و آزمون SEO و GEO ورسا

## خلاصهٔ اجرایی

نسخهٔ زنده در ممیزی اولیه بدنهٔ خالی برای خزنده، پاسخ ۲۰۰ برای نشانی اشتباه و صفحهٔ HTML به‌جای نقشهٔ سایت داشت. اکنون نسخهٔ محلی محصول، دسته، مقاله و صفحات عمومی را با React سمت سرور و محتوای فارسی در HTML اولیه تولید می‌کند. Nginx مسیرها را به سرویس فروشگاه می‌رساند. نشانی ناشناخته پاسخ ۴۰۴ و خرابی موقت منبع لازم پاسخ ۵۰۳ می‌دهد. قیمت و موجودی، متادیتا و Product/Offer از یک تصویر لحظه‌ای کاتالوگ در بازهٔ همان درخواست به دست می‌آیند.

سه راهنمای فارسی آشپزی و اصالت، ناوبری دسته‌ها، اطلاعات پیگیری سفارش و توضیحات محتاطانه دربارهٔ شاخص‌های کاتالوگ اضافه شده‌اند. تنظیم اولیهٔ ایندکس بسته است. تحویل برای اجرای preflight در staging آماده است. انتشار عمومی به تأیید مالک برای استقرار، اطلاعات کسب‌وکار و شرایط فروش، سپس آزمون روی دامنهٔ اصلی و فعال‌سازی صریح ایندکس نیاز دارد.

[ممیزی اولیه و تصمیم معماری](seo-audit.md) · [ممیزی GEO و نگاشت کلمات](seo-geo-content.md) · [چک‌لیست انتشار، حساب‌ها و backlog](seo-launch.md)

## تغییرات پیاده‌سازی

| بخش | فایل‌ها و تغییر |
| --- | --- |
| ساخت و سرویس | `artifacts/varsa-shop/vite.config.ts`، `seo-plugin.ts`، `serve-storefront.mjs`، `src/entry-server.tsx` و `src/http-seo.ts`. ساخت جداگانهٔ مرورگر و SSR، manifest پیش‌بارگذاری، پاسخ‌های HTTP، نقشهٔ پویا و robots زمان اجرا جایگزین snapshot متادیتا شدند. |
| مسیریابی | `src/lib/routes.ts`، `shop-filter.ts`، `page-context.tsx`، `src/App.tsx`، `browser-pages.ts` و `main.tsx`. صفحهٔ اول پس از آماده‌شدن قطعهٔ همان مسیر hydrate می‌شود. فرم پرداخت، مدیریت، حساب و صفحات عمومی قطعه‌های مجزا دارند. |
| سیاست ایندکس | `src/lib/page-meta.ts`، `public-page.ts`، `src/components/DocumentMeta.tsx`، `index.html`، `public/robots.txt`. canonical بدون پارامتر رهگیری، Open Graph و متادیتای اشتراک، ۳۰۸ برای دسته‌بندی قدیمی دارای کالا، noindex برای فیلتر وزن و مسیرهای خصوصی. |
| ساختار کاتالوگ | `src/pages/ShopPage.tsx`، `ProductRoute.tsx`، `src/components/ProductCard.tsx`، `PageBreadcrumbs.tsx` و `src/lib/product-jsonld.ts`. صفحات دسته بر اساس کالای فعال و جزئیات مستقل با مسیر راهنما و خرید. ProductModal و loader قدیمی متادیتا کنار گذاشته شدند. |
| محتوا | `src/lib/guide-articles.ts`، `buying-guide.ts`، `src/pages/GuidePage.tsx`، `ArticlePage.tsx`، `JournalPage.tsx`، `AboutPage.tsx`، `ContactPage.tsx` و بخش‌های مرتبط صفحهٔ اصلی/فوتر. سه راهنمای مستقل و هدف تجاری مجزا برای هر دستهٔ فعال. |
| داده و ورود | `src/lib/store-content.tsx`، `api.ts`، `cart.tsx`، `customer.tsx` و `theme.tsx`. دادهٔ عمومی هنگام SSR و hydration مشترک است. سبد، علاقه‌مندی و انتخاب تم از فضای ذخیرهٔ مرورگر بعد از شروع hydration خوانده می‌شوند. Endpoint محتوای عمومی، دسته‌های فعال را برمی‌گرداند. در خرابی جزئی منبع مقالات، API وضعیت ناقص را به SSR اعلام می‌کند. |
| تصاویر و فونت | `src/index.css`، `src/fonts.css`، `public/fonts/`، `public/brand/`، `src/components/Brand.tsx` و `DeliveryImage.tsx`. همان خانواده‌های فونت با WOFF2 و مجوز OFL میزبانی محلی دارند. نسخه‌های سبک‌تر نشان و تصویر واکنش‌گرای محصول از نسبت نمایش واقعی استفاده می‌کنند. |
| استقرار | `ops/varsa-storefront.service`، `nginx-varsa.conf`، `nginx-security-headers.conf` و `artifacts/varsa-shop/.env.example`. Nginx دارایی fingerprintشده را cache و HTML را به SSR محلی هدایت می‌کند. |
| پایش و آزمون | `src/lib/analytics.ts`، `artifacts/api-server/test/storefront-seo.test.ts`، `scripts/verify-deployment.ts` در بستهٔ API و `scripts/qa/seo-*.py`. رویدادهای مرور و سبد برای اتصال collector مبتنی بر رضایت تعریف شده‌اند. |

بسته‌های موجود React، React DOM، Wouter، Lucide و Radix Dialog برای اجرای سرویس SSR به بخش dependencies منتقل شدند. lockfile نسخه‌های قبلی آن‌ها را حفظ می‌کند. Playwright، axe-core و Nginx ویندوز ابزار آزمون محلی بودند. دادهٔ زندهٔ کاتالوگ در ممیزی با درخواست خواندنی بررسی شد.

## گزارش عملکرد

Chrome 157 در ۱۹ و ۲۰ نوامبر ۲۰۲۶ با viewport موبایل ۳۹۰×۸۴۴، DPR ۲، cache سرد، کندسازی CPU چهار برابر و محدودیت شبکهٔ ۱۵۰ms و ۲۰۰KiB/s اجرا شد. هر ستون میانهٔ سه بار بازکردن مستقیم صفحه است.

| معیار | صفحهٔ اصلی زنده در بررسی اولیه | صفحهٔ اصلی SSR پشت Nginx محلی | نمونهٔ محصول SSR پشت Nginx محلی |
| --- | ---: | ---: | ---: |
| LCP | ۴٬۷۶۸ ms | ۱٬۷۶۴ ms | ۲٬۴۰۴ ms |
| CLS | ۰٫۰۱۰۰ | ۰٫۰۲۸۹ | ۰٫۰۰۰۹۱ |
| JavaScript انتقال‌یافته | ۴۶۷٬۷۲۹ بایت | ۱۳۱٬۱۵۷ بایت | ۱۲۴٬۳۰۲ بایت |
| درخواست‌های محتوای عمومی از مرورگر در شروع | ۳ | ۰ | ۰ |
| حجم HTML انتقال‌یافته | ۹۹۷ بایت | ۱۴٬۵۲۸ بایت | ۸٬۰۶۵ بایت |

شمار بایت انتقال‌یافته هم به ساخت دارایی و هم به فشرده‌سازی Nginx وابسته است. خروجی خام ماژول ورودی مرورگر از حدود ۴۶۸ به ۳۱۳ کیلوبایت رسید. HTML اولیه محصول، مقاله و پیوندها را حمل می‌کند. در نمونهٔ محصول درخواست تصویر WebP از نسخهٔ ۹۶۰ به ۶۴۰ پیکسل رسید. بارگذاری قطعهٔ همان مسیر پیش از hydration مشکل بالا آمدن موقت فوتر را برطرف کرد و فضای breadcrumb روی موبایل ثابت شد.

این مقایسه یک مشاهدهٔ آزمایشگاهی میان میزبان عمومی و سرویس محلی است. اختلاف شبکه، فشرده‌سازی، داده و TLS در تفسیر نتیجه اثر دارد. درخواست عمومی PageSpeed از این محیط ۴۰۳ برگرداند. INP و صدک ۷۵ بازدید واقعی در این اجرا قابل تأیید نبودند. پایش میدانی پس از انتشار برای LCP ≤ ۲٫۵ ثانیه، INP ≤ ۲۰۰ میلی‌ثانیه و CLS ≤ ۰٫۱ لازم است. [تعریف و آستانهٔ Core Web Vitals](https://web.dev/articles/vitals)

## گزارش اعتبارسنجی

| حوزه | شواهد |
| --- | --- |
| ساخت monorepo و TypeScript | `pnpm run build` از typecheck سراسری، ساخت API و خروجی‌های مرورگر و SSR عبور کرد. |
| بستهٔ زمان اجرا و توسعه | lockfile با حالت frozen و offline بررسی شد. importهای خروجی SSR دقیقاً با پنج وابستگی production منطبق و entry در Node بارگذاری شد. رندر مستقیم محصول در Vite با `BASE_PATH=/store/` نیز ۲۰۰ و noindex برگرداند. |
| آزمون‌های برنامه | **۲۸۱ آزمون موفق** شامل checkout، موجودی، پرداخت کارت‌به‌کارت، عملیات پنل، پشتیبانی مشتری، API مقاله، متادیتا، خرابی منبع و محدودیت رضایت و محیط در رویدادهای اندازه‌گیری. |
| تست استقرار مستقل | اسکریپت `verify-deployment.ts` PostgreSQL و ذخیره‌ساز آزمایشی را راه انداخت. ۲۶ URL در خروجی sitemap بررسی شدند. مسیر مستقیم مقالهٔ نمونه بدنهٔ مقاله را برگرداند. هدرهای API، مجوز پنل و حذف اطلاعات خصوصی از خروجی log نیز آزموده شدند. [خروجی ماشینی](backend-deployment-smoke.json) |
| خزیدن از Nginx | در حالت میزبان canonical، ۲۶ نشانی یکتای sitemap از جمله ۱۲ SKU، چهار دستهٔ فعال و نمونه‌های مقاله و راهنما ۲۰۰، عنوان/توضیح یکتا و canonical دقیق داشتند. اعتبار MIME، HTML اولیه، قیمت و Offer، ۳۰۸، ۴۰۴، noindex خصوصی، HEAD و رفتار میزبان پیش‌نمایش در `seo-index-audit.py` بررسی شدند. |
| Chrome و دسترس‌پذیری | ۱۱ مسیر با JavaScript خاموش و ۲۴ بررسی صفحه در عرض‌های ۳۲۰، ۳۹۰، ۷۶۸ و ۱۴۴۰ پیکسل موفق بودند. برگشت و جلو رفتن تاریخچه، مسیر محصول، سبد، فرم سفارش آزمایشی و صفحهٔ پرداخت بدون خطای مرورگر اجرا شدند. axe در چهار صفحهٔ نمونهٔ اصلی، فروشگاه، محصول و راهنما برای قواعد WCAG اجراشده موردی گزارش نکرد. |
| Structured data | ساختارها با واژگان رسمی Schema.org و دادهٔ کاتالوگ در ممیزی ماشینی تطبیق داده شدند. Schema Markup Validator روی کد نمونهٔ صفحهٔ اصلی، یک محصول و یک راهنما ۵ مورد، ۰ خطا و ۰ هشدار گزارش کرد. Rich Results Test گوگل بعد از ارسال کد نمونه ادامه را به ورود حساب مشروط کرد. آزمون URL واقعی در مرحلهٔ انتشار ثبت شده است. [Schema Markup Validator](https://validator.schema.org/) · [Google Rich Results Test](https://search.google.com/test/rich-results) |

دستورهای بازتولید آزمون با سرویس‌های محلی و دادهٔ ایزوله

```powershell
pnpm run build
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/api-server verify:deployment
python -X utf8 scripts/qa/seo-index-audit.py --vocabulary PATH_TO_SCHEMA_ORG_JSONLD
python -X utf8 scripts/qa/seo-storefront.py --origin http://127.0.0.1:5181
python -X utf8 scripts/qa/seo-performance.py http://127.0.0.1:5181/
```

`seo-index-audit.py` به نمونهٔ محلی SSR با Host منطبق، robots فعال و Nginx محلی نیاز دارد. واژگان رسمی Schema.org را از انتشار ۳۰ دریافت کنید. برای آزمون مرورگر Playwright و Chrome لازم‌اند. آزمون browser ثبت سفارش را با پاسخ ساختگی محلی اجرا می‌کند. آزمون انتهابه‌انتها روی VPS، حساب‌های پایش و اندازه‌گیری میدانی در [چک‌لیست انتشار](seo-launch.md) آمده‌اند. [واژگان Schema.org نسخهٔ ۳۰](https://github.com/schemaorg/schemaorg/tree/main/data/releases/30.0)
