# شواهد پیاده‌سازی و آزمون — ۲۰۲۶-۱۰-۲۷

پیاده‌سازی محلی تکمیل و با سرویس‌های ایزوله بررسی شد. هیچ دیتابیس عملیاتی تغییر
نکرده، سرویس پولی خریداری نشده و چیزی منتشر نشده است.

## تغییرات

- بک‌اند TypeScript/Express/Drizzle با ماژول‌های catalog، inventory، orders،
  customers، content، support، notifications و files؛ exportهای قبلی برای
  سازگاری importها باقی مانده‌اند.
- جدول‌های مستقل بسته، موجودی، رزرو، گردش، تخفیف، اقلام/مشخصات سفارش، محتوا،
  آدرس، علاقه‌مندی و پیام؛ constraint و FK و index در migrationها.
- checkout تراکنشی، idempotency پایدار، کنترل فروش هم‌زمان، snapshot و وضعیت
  مستقل پرداخت/ارسال؛ پرداخت دستی پیش‌فرض unpaid است.
- S3-compatible adapter با read-back و SHA-256، مسیرهای قدیمی فایل و کنترل مالکیت؛
  فایل جدید Base64 در PostgreSQL ذخیره نمی‌شود.
- outbox و worker مستقل با lease، fencing token، retry و شکست نهایی؛ زمان lease،
  backoff و رزرو در مسیرهای هم‌زمان از ساعت PostgreSQL گرفته می‌شود.
- مقاله، contact و متادیتای مرورگر از API؛ بسته و فایل Supabase frontend حذف شد.
- migration صریح با checksum، قفل اجرای migration، backfill تراکنشی، گزارش
  تطبیق و حفظ منابع قدیمی؛ راهنمای استقرار و نمونه‌های Nginx/systemd/مجوز دیتابیس.

## اجرای واقعی

| بررسی | نتیجه |
|---|---|
| پایهٔ پیش از تغییر | ۲۳۷ تست موفق |
| `pnpm run build` | typecheck تمام workspace و build موفق |
| `pnpm --filter @workspace/api-server test` | ۲۵۶ موفق، صفر failed، صفر skipped |
| PostgreSQL واقعی | ۱۴ آزمون در سرور ایزوله، نه صرفاً شبیه‌سازی PGlite |
| S3 | S3rver محلی از طریق AWS S3 SDK؛ public/private و checksum و CLI copy موفق |
| CLI مهاجرت دیتابیس خالی | موفق، ۱۲ بسته؛ seed فقط با flag صریح |
| CLI ارتقای دادهٔ قدیمی نمونه | سفارش تاریخی، تخفیف/ارسال/آدرس، مشتری، پیام و دو فایل؛ تطبیق و تکرار موفق |
| شکست عمدی backfill | rollback کامل ردیف‌های جدید و حفظ منبع قدیمی |
| فرایند worker متوقف‌شده | lease پس از قطع فرایند با worker مستقل جدید بازیابی شد |
| نقش محدود runtime | checkout موفق؛ خواندن سند قدیمی و حذف سفارش رد شد |
| اجرای bundle ساخته‌شده | health/readiness برابر ۲۰۰، کاتالوگ ۱۲ بسته، مجله و کنترل ورود مدیر موفق |
| build سخت‌گیرانهٔ متادیتا | ۲۲ صفحه، صفر هشدار، پس از خاموشی upstream قدیمی |

سناریوهای PostgreSQL شامل رقابت بر آخرین موجودی، درخواست‌های هم‌کلید، سقف coupon،
لغو/انقضای هم‌زمان، snapshot پس از ویرایش محصول، claim چند worker، fencing و
سقف تلاش است. تست نگه‌داشتن قفل سند قدیمی و SKU نامرتبط نیز نشان می‌دهد checkout
به آن قفل‌ها وابسته نیست. تست‌های موجود مالکیت سفارش، فایل خصوصی، OTP، مرجوعی،
پشتیبانی و رفتار پنل حفظ و برای مدل جدید تطبیق داده شدند. تست‌های content، خود
توابع API فرانت را در برابر HTTP واقعی پروژه اجرا می‌کنند.

دادهٔ ارتقا نمونهٔ ایزوله با کاتالوگ دوازده‌تایی فعلی و سفارش/مشتری ساختگی است؛
ادعای مهاجرت دیتابیس واقعی فروشگاه نیست. گزارش smoke قابل خواندن ماشین در
`backend-deployment-smoke.json` ثبت شده است. logهای اجرای نهایی:

- `.local/backend-build-success.log`
- `.local/backend-tests-success.log`
- `.local/backend-deployment-success.log`

## اسکیل‌ها و حفاظت از وضعیت موجود

هر دو اسکیل از مخزن اصلی با helper رسمی skill-installer نصب و خوانده شدند:

| اسکیل | مسیر upstream |
|---|---|
| nodejs-backend-patterns | `wshobson/agents/plugins/javascript-typescript/skills/nodejs-backend-patterns` |
| supabase-postgres-best-practices | `supabase/agent-skills/skills/supabase-postgres-best-practices` |

Python shim ویندوز قابل اجرا نبود؛ Python همراه runtime استفاده شد. تلاش نخست
Node skill با مسیر backend-development ناموفق بود؛ مسیر فعلی با API مخزن اصلی
پیدا و نصب موفق تکرار شد. این شکست با نصب موفق اشتباه گرفته نشده است. قواعد
قفل‌گذاری مرتب، transaction کوتاه، SKIP LOCKED، pool، FK/index، حداقل مجوز و
خطای کنترل‌شده در پیاده‌سازی به نیاز فروشگاه تطبیق داده شدند؛ وابستگی جدیدی به
سرویس Supabase تحمیل نشده است.

پروژه Git ندارد و مخزن ساخته نشد. سورس اصلی، هش و زمان فایل‌ها پیش از ویرایش
در `.local/architecture-baseline-20261027/` ذخیره شدند. راهنماهای قدیمی در
`docs/history/` بایگانی شدند. سبک و اجزای ظاهری فروشگاه و پنل بازطراحی نشده‌اند.

## حدود اثبات و فعال‌سازی واقعی باقی‌مانده

- مقصد ایران، دامنه/TLS، PostgreSQL و bucket خصوصی و secrets واقعی باید تنظیم شوند.
- سرویس پیامک واقعی با قرارداد adapter و شناسهٔ پایدار باید متصل و smoke-test شود؛
  بدون پشتیبانی provider از idempotency، تحویل خارجی دقیقاً یک‌باره تضمین نمی‌شود.
- S3 روی سرور سازگار محلی آزمایش شد؛ endpoint، مجوز bucket و دسترسی شبکهٔ میزبان
  واقعی هنوز باید بررسی شوند. PostgreSQL تست باینری توسعهٔ embedded-postgres است؛
  سازگاری نسخه و تنظیمات دیتابیس میزبان هنگام rehearsal مقصد بررسی می‌شود.
- وزن تاریخی‌ای که در سفارش قدیمی ذخیره نشده قابل بازیابی قطعی نیست؛ با
  `legacyWeightUnknown` مشخص می‌شود. اطلاعات تاریخی موجود دست‌نخورده می‌ماند.
- backup/restore سرویس واقعی، rehearsal روی کپی مقصد و cutover با توقف نوشتن و
  تأیید جداگانهٔ مالک انجام می‌شود. راهبرد بازگشت پیش/پس از نوشتن جدید مستند است.
- دامنه و مقالهٔ smoke ساختگی‌اند؛ build انتشار باید با دامنه و محتوای واقعی و
  `SEO_REQUIRE_COMPLETE=1` تکرار شود. build معمول بدون این تنظیمات می‌تواند
  هشدار snapshot بدهد؛ آزمون strict محلی بدون هشدار موفق شده است.

پرداخت آنلاین، فروش عمده، حسابداری، UI جدید و مهاجرت کامل SSR/SSG خارج از هدف‌اند.
