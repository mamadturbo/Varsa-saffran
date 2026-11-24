# تقویت GEO زعفران ورسا

۲۰ نوامبر ۲۰۲۶. این گزارش تغییرات پروژه، آزمون نسخهٔ محلی و بازآزمایی پس از انتشار را ثبت می‌کند. وضعیت قبل از ویرایش در [خط پایهٔ زنده](geo-baseline-2026-11-20.md) آمده است.

نسخهٔ `geo-20261120-r1` پس از تأیید صریح مالک روی دامنهٔ اصلی فعال شد. SHA-256 بستهٔ آزموده‌شده و بارگذاری‌شده `CC81E0913B58AAECDD583AD516A85C0F5623CA13291268E85A37615B78E0C7F9` بود. نسخهٔ قبلی فروشگاه و پشتیبان تنظیمات و API در VPS نگه داشته شدند. [گزارش عملیاتی انتشار](seo-launch.md)

## صفحات و پشتوانهٔ مطالب

| صفحه | تغییر در نسخهٔ محلی | پشتوانه |
| --- | --- | --- |
| [خانه](https://varsasaffron.ir/) و [درباره](https://varsasaffron.ir/about) | معرفی کسب‌وکار با نام «زعفران ورسا» و `VARSA Saffron`، معرفی تیم ورسا و پیوند شناسنامهٔ اینماد. خانه `Organization` و `WebSite` هماهنگ دارد. `AboutPage` به همان شناسهٔ کسب‌وکار ارجاع می‌دهد. | نام از سایت فعلی و شناسنامهٔ از قبل درج‌شده. نقش تأمین، بسته‌بندی و فروش از پاسخ مالک در دور اول مصاحبه. |
| [تماس](https://varsasaffron.ir/contact) و فوتر | شمارهٔ عمومی ۰۹۳۰۸۲۹۴۴۷۰، فرم تماس و `ContactPage` متصل به همان سازمان. تحویل به پست حداکثر تا دو روز پس از ثبت، رهگیری در حساب و اطلاع‌رسانی کد با پیامک توسط تیم ورسا. امکان ثبت درخواست مرجوعی تا هفت روز بعد از تحویل برای آسیب پستی، نم‌زدگی، عیب یا مغایرت. | اطلاعات عملیات و شماره از مصاحبه. مسیر حساب و بازهٔ قابل تنظیم از [منطق حساب مشتری](../artifacts/api-server/src/modules/customers/router.ts) و [رابط حساب](../artifacts/varsa-shop/src/pages/CustomerAccount.tsx). ارسال جداگانهٔ کد با پیامک از تأیید مالک در سؤال پیگیرانه. پیامک واقعی یا زمان تحویل پستی در محیط محلی آزمودنی نبود. هزینهٔ ارسال از تنظیمات جاری فروشگاه می‌آید. برای رساندن کالا به مقصد، روز تحویل قطعی اعلام نشده است. |
| [پوشال یک‌مثقالی](https://varsasaffron.ir/products/poshal-1-mesghal)، [نگین یک‌مثقالی](https://varsasaffron.ir/products/negin-1-mesghal) و [سوپر نگین یک‌مثقالی](https://varsasaffron.ir/products/super-negin-1-mesghal) | مشخصات قابل‌مقایسه، کاربرد پیشنهادی، مقایسه با دو بستهٔ هم‌وزن، توضیح برش بازار و پیوند راهنماها. نام، دسته، وزن، قیمت و موجودی از کاتالوگ همان درخواست می‌آیند. `Product` و `Offer` متن معرفی، هویت برند و فروشنده و قیمت ریالی را هماهنگ می‌کنند. | انتخاب یک‌مثقالی و جایگاه پوشال اقتصادی، نگین برای خرید میانه و سوپر نگین برای هدیه یا تزیین از مصاحبه. مشخصات تجاری از کاتالوگ، مشخصات عمومی برش از [پژوهش طبقه‌بندی ظاهری](https://doi.org/10.1002/fsn3.1478) و [اتحادیهٔ صادرکنندگان زعفران خراسان رضوی](https://iransaffronunion.com/انواع-دسته-بندی-زعفران/). |
| [راهنمای انتخاب](https://varsasaffron.ir/guide) | پاسخ مستقیم به فرق نگین و پوشال و پیوند بسته‌های مثقالی همراه مبلغ امروز کاتالوگ. | مطالعهٔ طبقه‌بندی ظاهری و قیمت فعلی کاتالوگ. [پژوهش برش‌ها](https://doi.org/10.1002/fsn3.1478) |
| [اصالت](https://varsasaffron.ir/guide/check-saffron) | پاسخ کوتاه در ابتدای متن، تطبیق شناسه و تاریخ گزارش با بسته، نقش خامهٔ روشن و محدودیت آزمون خانگی. ارجاع‌ها کنار توضیح و در `Article.citation`، همراه پیوند بسته‌های مرتبط. | [پژوهش برش‌ها](https://doi.org/10.1002/fsn3.1478)، [ISO 3632-1:2025](https://www.iso.org/standard/86798.html)، [سند AOAC دربارهٔ دامنهٔ آزمایش هدفمند زعفران پودری](https://www.aoac.org/wp-content/uploads/2022/11/SMPR-2021_014.pdf). |
| [دم‌کردن](https://varsasaffron.ir/guide/brew-saffron) | پاسخ کوتاه، توضیح آب گرم و زمان افزودن به برنج، با پیوند بسته‌های پوشال و نگین. | نتیجهٔ رنگ‌دهی در شرایط مشخص پژوهش با ذکر دما و زمان. ترتیب افزودن به برنج نمونهٔ آشپزی است. [پژوهش دم‌کردن](https://doi.org/10.3390/molecules29133080) |
| [نگهداری](https://varsasaffron.ir/guide/store-saffron) | پاسخ کوتاه دربارهٔ ظرف دربسته و جای خشک و تاریک، پرسش آسیاب‌کردن، بررسی برچسب و پیوند تماس و بسته‌ها. | پژوهش افت رنگ‌دهی نمونه‌های در معرض نور و برچسب هر بسته برای تاریخ و شرایط نگهداری. [پژوهش نگهداری](https://air.unimi.it/bitstream/2434/935655/2/Saffron_Leoni%20et%20al.%202022.pdf) |

پرسش‌های راهنما با اجازهٔ مالک به‌صورت تحریریه نوشته شدند. عکس واقعی سه بسته و گزارش قابل انتشار ارائه نشد. تصاویر موجود با برچسب تصویرسازی نمایش داده می‌شوند. توضیح برش مربوط به دسته‌بندی بازار است و برای هر محموله ادعای اندازه، خلوص، منشأ، گواهی یا برتری عطر و طعم مطرح نمی‌کند. عددهای کروسین، پیکروکروسین و سافرانال از نمایش همهٔ محصولات و از خروجی عمومی API و دادهٔ اولیهٔ مرورگر حذف شدند. رکوردهای داخلی کاتالوگ و جریان مدیریت و سفارش حفظ شدند.

## مقایسهٔ خط پایه، نسخهٔ محلی و نسخهٔ زنده

| بررسی | نسخهٔ زنده پیش از ویرایش | نسخهٔ آزمایشی محلی |
| --- | --- | --- |
| HTML اولیه، canonical و sitemap | ۲۵ نشانی در sitemap و HTML اولیهٔ همهٔ صفحات نمونه | ۲۵ نشانی با کاتالوگ گرفته‌شده از خط پایه، ۱۲ محصول، عنوان و توضیح یکتا، canonical و `lang=fa-IR` و `dir=rtl` |
| مسیرهای عمومی و خصوصی | robots سایت زنده گروه عمومی و sitemap را معرفی می‌کرد | robots، رفتار میزبان پیش‌نمایش، `noindex` حساب و پرداخت، ۳۰۸ مسیر تغییرشکل‌یافته، ۴۰۴ مسیر ناموجود و HEAD با آزمون HTTP تأیید شدند. |
| هویت و تماس | `Organization` صفحهٔ اصلی با نام کوتاه. تماس مستقیم در HTML نبود. | نام کامل فارسی، نام انگلیسی، `tel:` یکسان در متن و اسکیما، پیوند سازمان مشترک در درباره، تماس و Offer. |
| سه محصول مثقالی | قیمت و وزن کاتالوگ در HTML و اسکیما، پیوند اصالت، شاخص‌های بدون مدرک قابل پیوند | همان قیمت و وزن در آزمون با نمونهٔ کاتالوگ. مقایسهٔ قیمت بسته‌ها از همان کاتالوگ. پیوندهای سه راهنما و بسته‌های هم‌وزن، حذف شاخص‌ها از همهٔ پاسخ‌های عمومی آزموده‌شده. |
| سه راهنما | پاسخ کوتاه در شروع متن، پیوند عمومی فروشگاه و برخی منابع در پایان | منبع کنار توضیح فنی، `Article.citation` منطبق با پیوندهای بدنه و پیوند مستقیم محصول. |
| استناد موتور پاسخ | صفر استناد به دامنه در سه پاسخ ChatGPT Search. [نتایج و گزارش HubSpot](geo-baseline-2026-11-20.md) | بازآزمایی روی دامنهٔ عمومی پس از انتشار انجام شد. |

در ممیزی پس از انتشار، هر ۲۵ URL نقشهٔ سایت از بیرون VPS با وضعیت ۲۰۰، canonical منطبق، متن فارسی در HTML اولیه، عنوان و توضیح یکتا و اسکیما مطابق واژگان Schema.org پاسخ دادند. برای هر ۱۲ محصول، هویت کالا، وزن و قیمت Offer با API تطبیق داده شد. شمارهٔ تماس، فروشنده، پیوندهای مقایسه و منابع راهنما در HTML زنده تأیید شدند. بررسی robots، HEAD، تغییرمسیر، ۴۰۴ و noindex حساب و پرداخت موفق بود. [خروجی ممیزی سایت زنده](../.local/geo-qa/live-http.log)

### پرسش‌های ثابت پس از انتشار

۲۰ نوامبر ۲۰۲۶، به وقت تهران، بلافاصله پس از انتشار. هر پرسش در گفت‌وگوی مستقل و بدون ورود حساب با Web search فعال اجرا شد. پیوندهای جدول استنادهای متنیِ مشاهده‌شده‌اند.

| موتور | عبارت | شناسایی ورسا | استناد مشاهده‌شده | مقصد ورسا | ارزیابی پاسخ |
| --- | --- | --- | --- | --- | --- |
| ChatGPT Search | زعفران ورسا چیست؟ | خیر. برند را به‌عنوان یک احتمال مطرح کرد. | [مقالهٔ محمدحسن ابریشمی](https://drmhabrishami.ir/?p=151) · [مدخل «ورس» واژه‌یاب](https://vajehyab.com/?q=%D9%88%D8%B1%D8%B3&s=text&t=like) | — | همچنان کسب‌وکار و دامنه را تشخیص نداد و با واژهٔ «ورس» مقایسه کرد. |
| ChatGPT Search | تفاوت نگین و پوشال چیست؟ | خیر | [اتحادیهٔ صادرکنندگان زعفران خراسان رضوی](https://iransaffronunion.com/انواع-دسته-بندی-زعفران/) · [زعفرون](https://zaffaron.ir/articles/درجه-بندی-زعفران-سرگل-نگین-پوشال/) · [زعفران قائنات](https://saffronghaenat.ir/product-category/saffron-negin/) | — | فرق ظاهری و خامه را توضیح داد و در همان پاسخ دربارهٔ خلوص و رنگ‌دهی بر اساس نوع برش تعمیم داد. در پایان، اهمیت آزمون کیفیت را یادآور شد. |
| ChatGPT Search | چطور اصالت زعفران را بررسی کنم؟ | خیر | [مقالهٔ PubMed Central](https://pmc.ncbi.nlm.nih.gov/articles/PMC10474180/) · [AOAC SMPR 2021.014](https://www.aoac.org/wp-content/uploads/2022/11/SMPR-2021_014.pdf) · [پژوهش Food Chemistry](https://www.sciencedirect.com/science/article/pii/S0308814618314924) | — | آزمون تکمیلی و برگهٔ آزمایش را مطرح کرد. آب سرد را با زمان ۱۰ تا ۱۵ دقیقه پیشنهاد داد و برای آن بخش استناد مستقیم نداد. تطبیق شناسهٔ محموله در پاسخ نیامد. |
| Perplexity | هر سه عبارت بالا | اجرا نشد | — | — | بارگذاری دوباره به صفحهٔ خالی بدون کادر پرسش رسید. |

ذکر تأییدشدهٔ برند و استناد به دامنه در ChatGPT Search در هر دو نوبت **۰ از ۳** بود. بازکردن دوبارهٔ گزارش HubSpot با همان چهار ورودی، همان امتیازهای **۳۳، ۳۲ و ۴۷** را نمایش داد. وضعیت مستقل Perplexity، Gemini و Copilot در خط پایه ثبت شده است. [گزارش HubSpot AI Search Grader](https://www.hubspot.com/ai-search-grader/results?companyName=%D8%B2%D8%B9%D9%81%D8%B1%D8%A7%D9%86+%D9%88%D8%B1%D8%B3%D8%A7+%28VARSA+Saffron%29&geography=Iran&productsServices=Packaged+saffron+for+cooking+and+gifts&industry=Online+saffron+retail)

آخرین شاهد Search Console تصویر روز انتشار است. sitemap با وضعیت `Success` و ۲۵ URL کشف‌شده دیده شد و Page indexing روی پردازش بود. آزمون فوری موتور پاسخ پیش از تأیید خزش و ایندکس مجدد انجام شد. مقایسهٔ پس از ایندکس و بررسی تاریخ آخرین خزش خانه، صفحهٔ درباره، راهنمای اصالت و یک محصول مثقالی در URL Inspection باز مانده است. [Search Console](https://search.google.com/search-console)

## بازتولید

- ساخت و آزمون کد. `pnpm run build` و `pnpm --filter @workspace/api-server test`. مجموعهٔ کامل شامل ۲۸۱ آزمون موفق بود. برای خدمت‌های آزمون و PostgreSQL ایزوله، دسترسی loopback لازم است.
- ممیزی مستقل مرورگر و HTTP. `& ./.local/geo-verify.ps1` به Nginx محلی پروژه، Python و Playwright/Chrome متکی است. این اجرا از کاتالوگ عمومی ثبت‌شدهٔ خط پایه استفاده می‌کند و فقط روی loopback اجرا می‌شود. اسکریپت‌های مستقل [ممیزی HTTP و اسکیما](../scripts/qa/seo-index-audit.py) با پرچم `--geo` و [آزمون مرورگر](../scripts/qa/seo-storefront.py) نیز از همان مبدأ محلی قابل اجرا هستند.
- در Chrome، ۱۳ مسیر بدون JavaScript و ۴۸ بررسی در عرض‌های ۳۲۰، ۳۹۰، ۷۶۸ و ۱۴۴۰ پیکسل موفق بودند. مسیر افزودن به سبد تا صفحهٔ پرداخت با سفارش شبیه‌سازی‌شده موفق بود. خطای صفحه یا hydration مشاهده نشد. axe در ده صفحهٔ نمونه در قواعد بررسی‌شده موردی گزارش نکرد. [خروجی محلی مرورگر](../.local/geo-qa/browser.log) · [خروجی محلی HTTP](../.local/geo-qa/http.log)
- ممیزی خواندنی دامنه پس از انتشار با `python -X utf8 scripts/qa/seo-index-audit.py --live --geo --origin https://varsasaffron.ir --vocabulary .local/seo-qa/schemaorg-current-https.jsonld` اجرا می‌شود.
- اندازه‌گیری موتورهای پاسخ. سه عبارت و روش اجرای ثابت در [خط پایه](geo-baseline-2026-11-20.md) آمده‌اند. پس از انتشار، ابتدا HTTP و کاتالوگ عمومی دامنه با همین مسیرها مقایسه شوند. هر عبارت در گفت‌وگوی مستقل با جست‌وجوی وب اجرا شود و تاریخ تهران، موتور، زبان، ذکر برند، پیوند استناد، مقصد و دقت ثبت شود. وضعیت `Page indexing` پس از پایان پردازش و نتیجهٔ URL Inspection زمان مناسب آزمون بعدی را مشخص می‌کنند. امتیاز HubSpot با همان چهار ورودی تکرار شود.

## فایل‌های اصلی

- هویت و نمایش تماس. [brand-identity.ts](../artifacts/varsa-shop/src/lib/brand-identity.ts)، [contacts.ts](../artifacts/varsa-shop/src/lib/contacts.ts)، [AboutPage.tsx](../artifacts/varsa-shop/src/pages/AboutPage.tsx)، [ContactPage.tsx](../artifacts/varsa-shop/src/pages/ContactPage.tsx)، [Footer.tsx](../artifacts/varsa-shop/src/components/Footer.tsx)، [StoryPreview.tsx](../artifacts/varsa-shop/src/components/home/StoryPreview.tsx)، [site.ts](../artifacts/varsa-shop/src/lib/site.ts)، [store-content.tsx](../artifacts/varsa-shop/src/lib/store-content.tsx)
- محصول، راهنما و اسکیما. [representative-products.ts](../artifacts/varsa-shop/src/lib/representative-products.ts)، [ProductRoute.tsx](../artifacts/varsa-shop/src/pages/ProductRoute.tsx)، [ProductCard.tsx](../artifacts/varsa-shop/src/components/ProductCard.tsx)، [guide-articles.ts](../artifacts/varsa-shop/src/lib/guide-articles.ts)، [GuidePage.tsx](../artifacts/varsa-shop/src/pages/GuidePage.tsx)، [ArticlePage.tsx](../artifacts/varsa-shop/src/pages/ArticlePage.tsx)، [page-meta.ts](../artifacts/varsa-shop/src/lib/page-meta.ts)، [product-jsonld.ts](../artifacts/varsa-shop/src/lib/product-jsonld.ts)
- قرارداد کاتالوگ و سازگاری سبد. [products.ts](../lib/catalog/src/products.ts)، [catalog/http.ts](../artifacts/api-server/src/modules/catalog/http.ts)، [public-page.ts](../artifacts/varsa-shop/src/lib/public-page.ts)، [cart-state.ts](../artifacts/varsa-shop/src/lib/cart-state.ts)، [types.ts](../artifacts/varsa-shop/src/lib/types.ts)، [buying-guide.ts](../artifacts/varsa-shop/src/lib/buying-guide.ts)، [product-comparison.ts](../artifacts/varsa-shop/src/lib/product-comparison.ts)
- آزمون‌های قرارداد. [management.test.ts](../artifacts/api-server/test/management.test.ts)، [restored-catalog.test.ts](../artifacts/api-server/test/restored-catalog.test.ts)، [product-jsonld.test.ts](../artifacts/api-server/test/product-jsonld.test.ts)
