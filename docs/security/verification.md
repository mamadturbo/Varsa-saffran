# نتیجهٔ اعتبارسنجی محلی

تاریخ: ۵ آبان ۱۴۰۵ (۲۰۲۶/۱۰/۲۷). تمام migrationها، ارسال‌های ساختگی و probeهای فعال روی محیط تازهٔ محلی با دادهٔ آزمایشی انجام شدند. اتصال عملیاتی، انتشار و پیامک واقعی استفاده نشده‌اند.

## اجرا و نتیجه

| بررسی | نتیجه | شاهد |
|---|---|---|
| کل تست‌های API، فرانت مشترک، مهاجرت و PostgreSQL | **۲۶۳ موفق، صفر شکست/skip** | `.local/security-acceptance-tests.log` |
| PostgreSQL واقعی با دو نمونهٔ API | TOTP هم‌زمان یک بار مصرف شد؛ logout در نمونهٔ دیگر نشست را رد کرد | `test/postgres-commerce.test.ts`؛ در مجموعهٔ کامل اجرا شد |
| نقش runtime واقعی | checkout مجاز؛ ساخت مدیر، حذف سفارش/audit و دسترسی سند قدیمی ممنوع؛ startup نقش owner را رد کرد | `test/postgres-commerce.test.ts` |
| typecheck کل workspace | موفق | `.local/security-typecheck-acceptance.log` |
| build کل workspace | موفق | `.local/security-workspace-build-acceptance.log` |
| deployment smoke با **migration و CLI ساخته‌شده** | موفق؛ strict frontend metadata: ۲۲ صفحه، صفر هشدار | `.local/security-deployment-acceptance.log` و `../backend-deployment-smoke.json` |
| ساخت و reset مدیر با CLI ساخته‌شده | موفق روی PostgreSQL تازه؛ نشست قبلی باطل شد | `operator-verification.json` |
| scan محدود HTTP | **۱۵ بررسی موفق**؛ فقط loopback | `local-scan.json`؛ `scripts/security-local-scan.mjs` |
| audit production pnpm | صفر advisory | `.local/security-production-audit.json` |
| audit کامل و policy CI | صفر مورد بازبینی‌نشده؛ سه advisory محدود dev با استثنای دقیق | `dependency-exceptions.json`، `scripts/security-audit.mjs` |
| Gitleaks 8.30.1، checksum رسمی | یک تطبیق نهایی: public anon JWT در .env محلی قدیمی، پس از بررسی role رد شد؛ راز خصوصی تأییدشده پیدا نشد | `.local/security-secrets-final.json`، SEC-011 |
| JWT قدیمی در خروجی فرانت | یافت نشد | `frontend-secret-check.json` |

پوشه Git ندارد؛ اسکن history اینجا اجرا نشد. workflow اسکن dependency و Git history با Gitleaks برای push/PR آماده شده است، اما اجرای GitHub CI در این کار انجام نشده است. استثناهای dev تا ۲۰۲۶/۱۱/۲۷ باید دوباره بررسی شوند؛ نسخه/مسیر/advisory جدید خودکار مستثنی نمی‌شود.

## کنترل‌های regression اجراشده

- مدیر: Argon2id، enrollment بدون مجوز پنل، رمزگذاری secret، تأیید TOTP، رد password-only، ضد replay و هم‌زمانی، recovery هش‌شده و یک‌بارمصرف، ابطال نشست در recovery/رمز/حذف MFA، خروج، idle و absolute expiry، رد Bearer قبلی و cookie مشتری، cookie امن production.
- CSRF/HTTP: نبود Origin بدون توکن رد می‌شود، token/cookie جعلی یا مبدأ نامجاز/Fetch Metadata cross-site رد می‌شود؛ JSON معیوب 400، بدنهٔ زیاد 413، نوع نامناسب و compression 415. پاسخ‌ها stack، SQL و hash نشست/رمز را نمی‌دهند. درخواست با header IP جعلی سهمیهٔ مستقل نمی‌گیرد.
- مشتری: OTP کوتاه‌عمر و یک‌بارمصرف، پنج تلاش challenge، resend هم‌زمان فقط یک ارسال، verify هم‌زمان فقط یک موفقیت؛ target rotation و header جعلی نمی‌توانند سقف شبکه/کل verify را دور بزنند. تغییر شماره با تأیید هر دو شماره و ابطال نشست، بدون merge حساب دیگر؛ دسترسی سفارش، claim مهمان، آدرس، تیکت و فایل بین دو مشتری بررسی شده است.
- فایل: MIME جعلی، SVG/HTML، bytes خراب، اندازه، ابعاد و سقف پیکسل رد می‌شوند؛ encode WebP metadata را حذف می‌کند؛ quota سراسری در رقابت رعایت می‌شود؛ فایل خصوصی برای ناشناس/مشتری دیگر رد می‌شود.
- سفارش/موجودی: قیمت سرور، coupon limit، retry idempotent، فروش آخرین واحد، رزرو/آزادسازی دقیقاً یک‌باره، form قدیمی موجودی و worker lease روی PostgreSQL واقعی موفق‌اند.
- grants: migration حتی grant مستقیم به anon را حذف می‌کند؛ فقط REVOKE PUBLIC فرض نشده است.
- upload ناشناس با بدنهٔ خراب یا ۷MiB پیش از JSON parsing رد می‌شود؛ حساب و سهمیهٔ پایدار پیش از تخصیص بدنه بررسی می‌شوند. سقف ساعت/روز SMS و هشدار audit، و سهمیهٔ مستقل فایل دو حساب، تست اختصاصی دارند.
- log: deployment smoke، API ساخته‌شده را با logging فعال اجرا کرد و password، OTP، authorization، cookie، query و CSRF sentinel ارسال کرد؛ این مقادیر در log واقعی نبودند. این نتیجه به معنی بررسی logهای میزبان عملیاتی یا provider نیست.

## مرورگر

نسخهٔ build شده با API محلی PostgreSQL و S3 emulator ایزوله بررسی شد:

| مسیر | نتیجه |
|---|---|
| bootstrap مدیر → ثبت TOTP → تأیید کد → recovery codes → پنل | موفق |
| مدیر تنظیم‌شده با رمز تنها | رد شد؛ تصویر `admin-mfa-browser.png` |
| ورود با TOTP معتبر و ورود با recovery | موفق |
| خروج و بارگذاری مجدد نشست | موفق؛ آخرین UI پیش از بررسی سرور، منوی پنل را نمایش نمی‌دهد |
| تنظیمات امنیت حساب | فیلدهای reauth و اقدامات نمایش داده شدند؛ تغییر رمز/حذف MFA با تست integration پوشش دارند |
| فرم تماس با دادهٔ ساختگی | موفق؛ پاسخ دریافت پیام نشان داده شد |
| OTP مشتری | درخواست و تأیید کد آزمایشی و ورود موفق، بدون پیامک واقعی |
| صفحهٔ محصول و metadata | نمایش موفق زیر CSP |
| log کنسول در صفحات بررسی‌شده زیر CSP واقعی | خطای CSP/اجرای script مشاهده نشد |

اسکن HTTP ابتدا نشان داد `preview.headers` روی HTML تولیدشدهٔ metadata اعمال نمی‌شود. محل ارسال همان HTML در `seo-plugin.ts` اصلاح شد؛ سپس وجود CSP روی پاسخ واقعی و رفتار مرورگر مجدداً تأیید شد. Nginx تولید همان policy را دارد، ولی نصب واقعی Nginx/TLS هنوز اجرا نشده است.

## اسکن خودکار و حدود آن

ZAP، Java و Docker نصب نبودند؛ اجرای ZAP ادعا نمی‌شود. probeهای محدود HTTP و تست‌های regression جدا اجرا شدند و نتیجهٔ ابزار به‌تنهایی آسیب‌پذیری قطعی نامیده نشد. اسکن active روی سایت عمومی یا provider انجام نشد. این پوشش جای penetration test مستقل، تست ظرفیت یا بررسی تنظیم واقعی میزبان را نمی‌گیرد.

## تفکیک اجرا، تست و مستندات

- **اجرا و تست‌شده:** احراز هویت مدیر/MFA/نشست، CSRF، validation و headerهای API و preview، rate limit پایدار، بودجهٔ پیامک، encode/مالکیت/quota فایل، تغییر امن شماره، grants، گردش سفارش/موجودی، migration و CLI محلی، audit و بررسی نشت log.
- **پیاده‌سازی‌شده و نیازمند فعال‌سازی میزبان:** نقش login واقعی runtime و owner، TLS، Nginx، private bucket، firewall، user غیرroot و resource limits، اتصال هشدار SMS به monitoring. نمونه‌ها و startup checks آماده‌اند.
- **صرفاً مستندشده برای میزبان آینده:** backup رمزگذاری‌شدهٔ عملیاتی، آزمون بازیابی واقعی و RPO/RTO، بازبینی log/provider، فرایند انسانی بازیابی مشتری بدون شماره. هیچ اجرای عملیاتی برای آن‌ها انجام نشده است.
- **ریسک باقی‌ماندهٔ محدود:** سه advisory در S3rver loopback-only توسعه؛ review تاریخ‌دار، بدون import در API/worker. فایل‌های قدیمی بدون بازنویسی حفظ شده‌اند؛ سقف decoder برای upload جدید اعمال می‌شود. reservation شکست‌خوردهٔ S3 نیازمند reconcile اپراتور است.
- **قابلیت API بدون فرم جدید:** تغییر شماره با تأیید هر دو طرف تست شده؛ UI جداگانه برای آن اضافه نشده است.

یافتهٔ بحرانی یا مهمِ حل‌نشدهٔ تأییدشده در کد محلی بررسی‌شده باقی نمانده است. SEC-007 و بخش عملیاتی SEC-004/006 به میزبان انتخاب‌نشده وابسته‌اند و «انجام‌شده روی میزبان» محسوب نمی‌شوند. این تحویل آمادهٔ بررسی و فعال‌سازی است؛ مجوز انتشار یا migration عملیاتی نیست.

