# یافته‌های امنیتی ورسا — ۲۰۲۶/۱۰/۲۷

این گزارش بر کد فعال و نسخهٔ مبنا در `.local/security-baseline-20261027` تکیه دارد، نه ادعای READMEهای قبلی. وضعیت نهایی تست‌ها در `verification.md` ثبت می‌شود. «نیازمند تنظیم میزبان» به معنی اجرای آن تنظیم روی سرور واقعی نیست.

| شناسه | شدت در محصول | نوع | وضعیت |
|---|---|---|---|
| SEC-001 | مهم | ضعف اثبات‌شدهٔ مدیر | رفع‌شده؛ اعتبارسنجی در verification |
| SEC-002 | مهم | CSRF و trust مبدأ | رفع‌شده |
| SEC-003 | متوسط | تصویر و مصرف منابع | رفع‌شده برای آپلودهای جدید |
| SEC-004 | مهم | abuse و هزینهٔ پیامک | رفع‌شده در کد؛ اتصال هشدار نیازمند میزبان |
| SEC-005 | مهم | dependency مسیر عمومی | رفع‌شده؛ نسخه و audit ثبت می‌شود |
| SEC-006 | متوسط | HTTP و خطا و log | رفع‌شده در کد؛ edge نیازمند میزبان |
| SEC-007 | مهم در صورت پیکربندی غلط | زیرساخت نامعلوم | نیازمند تنظیم میزبان |
| SEC-008 | متوسط | بازیابی و تغییر شماره | رفع‌شده با تأیید دو شماره؛ فقدان دسترسی به شماره نیازمند فرایند انسانی |
| SEC-009 | مهم در صورت وجود | IDOR و فساد سفارش | ردشده با شواهد برای مسیرهای بررسی‌شده؛ تست regression حفظ شده |
| SEC-010 | پایین در محصول | tooling dev فقط | ریسک باقی‌ماندهٔ محدود و مستند |
| SEC-011 | اطلاعاتی | secret scanner | ردشده با شواهد برای دو تطبیق اولیه |
| SEC-012 | مهم | تخصیص بدنهٔ upload پیش از ورود | رفع‌شده؛ تست روی API ساخته‌شده |

## SEC-001 — حساب و نشست مدیر

- شواهد مبنا: `artifacts/api-server/src/lib/admin-auth.ts:11–31` توکن HMAC فقط شامل expiresAt؛ `:34–68` رمز مشترک `VARSA_ADMIN_PASSWORD`؛ `artifacts/varsa-shop/src/lib/orders-api.ts:12–27` توکن sessionStorage؛ `main.tsx:7` افزودن Bearer به همهٔ درخواست‌ها. MFA، هویت حساب، revoke و logout سرور وجود نداشت.
- شرط سوءاستفاده: دانستن/حدس رمز مشترک یا خواندن توکن با XSS. اثر: همهٔ سفارش‌ها، تیکت‌ها و ویرایش قیمت/موجودی تا پایان TTL؛ خروج مرورگر توکن سرقت‌شده را باطل نمی‌کرد.
- اصلاح اجراشده: `lib/admin-security.ts` حساب مشخص و Argon2id، session تصادفی با hash، HttpOnly/Secure در production، ۸ ساعت مطلق/۲۰ دقیقه بی‌فعالیتی؛ enrollment ده‌دقیقه‌ای بدون دسترسی پنل، TOTP معتبر با OTPAuth و شمارندهٔ ضد replay، AES-256-GCM با کلید مستقل، ده recovery تصادفی هش‌شده. تغییر رمز، recovery و حذف عامل دوم نشست‌ها را باطل می‌کنند. توکن قبلی پذیرفته نمی‌شود.
- حساب فقط از CLI اپراتور ساخته/بازیابی می‌شود. API ساخت عمومی وجود ندارد. پنل در حذف MFA تا ثبت دوبارهٔ عامل دوم بسته می‌ماند. audit برای ورود و عملیات حساس وجود دارد.
- آزمون: `test/admin-login.test.ts`، `test/order-workflow.test.ts`؛ تست مرورگر و CLI در verification.

## SEC-002 — CSRF و مبدأ

- شواهد مبنا: `modules/customers/auth.ts:81–94` در نبود Origin بازمی‌گشت و origin همان Host درخواست را به allowlist اضافه می‌کرد. کنترل واحد روی تماس و ورود مدیر وجود نداشت.
- شرط: درخواست خارج از سایت، یا client/proxy که Origin را حذف کند و کوکی معتبر داشته باشد. اثر احتمالی: ورود ناخواسته یا تغییر منابع. SameSite و JSON برخی زنجیره‌های browser را محدود می‌کردند؛ نبود Origin به‌تنهایی اثبات اجرای همهٔ حملات مرورگری نیست.
- اصلاح: middleware عمومی پیش از parsing و routing؛ nonce امضاشده + cookie HttpOnly + header متناظر، کنترل Origin پیکربندی‌شده و Fetch Metadata، رفض فرم غیرJSON؛ login نیز پوشش دارد. Host/forwarded Host هیچ مبدأ مورداعتماد تولید نمی‌کند. نبود Origin تنها با توکن معتبر قابل قبول است.
- آزمون: missing Origin/token، evil Origin، Sec-Fetch-Site، فرم و token جعلی در `admin-login.test.ts`.

## SEC-003 — تصویر و سهمیه

- شواهد مبنا: `modules/files/storage.ts:106–132` فقط magic و ۴MB؛ bytes اصلی مستقیماً S3 می‌شدند؛ بررسی ابعاد، decode، encode و quota وجود نداشت.
- شرط: مشتری دارای نشست یا مدیر upload کند. اثر: تصویر مخرب/خراب، metadata اضافی، مصرف decoder و storage.
- اصلاح: Sharp با failOn warning، سقف ۱۶ میلیون پیکسل، هر بُعد ۶۰۰۰، یک frame، پنج ثانیه پردازش، دو decode هم‌زمان، cache محدود؛ خروجی WebP بازکدگذاری‌شده بدون metadata. SVG/HTML/executable و MIME ناسازگار رد می‌شوند. reservation سهمیه با قفل کوتاه DB پیش از ارسال S3 اتمیک است؛ پیش‌فرض ۱۰۰MiB حساب/۱۰GiB کل.
- نام/مسیر سرور، مالکیت و `private, no-store` حفظ شده‌اند. فایل قدیمی در migration عمداً بازنویسی نشده است؛ بازبینی و تبدیل آن‌ها باید جدا و با backup انجام شود.
- محدودیت عملیاتی: upload با شکست S3 سهمیهٔ رزروشده را آزاد نمی‌کند تا oversubscription رخ ندهد؛ اپراتور mapping بدون object را reconcile می‌کند. این کار به حذف خودکار دادهٔ کاربر تبدیل نشده است.

## SEC-004 — abuse و پیامک

- شواهد مبنا: checkout مهمان limiter اختصاصی نداشت؛ `modules/customers/auth.ts` برای OTP سقف داشت اما `notifications/queue.ts` بودجهٔ مشترک ارسال با OTP نداشت؛ تماس فقط روی IP محدود بود.
- شرط: درخواست‌های متعدد، شماره‌های مختلف، یا اعلان‌های زیاد. اثر: هزینهٔ SMS، اختلال ورود و پرشدن سفارش‌های مهمان.
- اصلاح: bucketهای پایدار شبکه/هویت/کل در PostgreSQL، account-based محدودیت مدیر و reauth، بررسی OTP روی شماره، شبکه و کل؛ checkout روی شماره و شبکه و کل، upload سراسری و حساب؛ تماس روی شماره/شبکه/کل. API و worker از یک بودجهٔ SMS ساعتی و روزانه استفاده می‌کنند. هر تلاش ارسال audit دارد؛ رسیدن به سقف audit و پیام ثابت `security_alert:sms_budget_exhausted` می‌سازد.
- سقف‌ها شمارندهٔ تلاش ارسال‌اند؛ تأیید نهایی تحویل و صورتحساب وابسته به provider است. مسیریابی این هشدار به monitoring میزبان هنوز باید فعال شود. CAPTCHA بدون شاهد نیاز اضافه نشده است.

## SEC-005 — وابستگی‌ها

- شواهد: audit اولیهٔ pnpm بر lockfile، ۳۹ advisory شامل یک critical؛ گزارش خام redacted/بدون secrets در `.local/security-dependency-audit.json`.
- مسیرهای عمومی مهم: `express > proxy-addr` (تفسیر IP)، `express > body-parser` (درخواست فشرده)، `qs`، `zod`. `body-parser` حتی پیش از route بدنه را می‌خواند؛ با معتبر بودن CSRF هم دفاع لازم است.
- اصلاح: نسخه‌های سازگار مشخص در workspace overrides و lockfile، شامل proxy-addr 2.0.8، body-parser 2.4.0، qs 6.16.0، zod 4.6.6. پذیرش بدنهٔ فشرده نیز با `inflate:false` بسته شد. اسکن مجدد و typecheck/build/test لازم است؛ «audit fix --force» اجرا نشد.
- ابزارها: esbuild، Vite و وابستگی‌های compatible build نیز به نسخهٔ اصلاح‌شده منتقل شدند؛ تغییر API اصلی یا معماری انجام نشد.
- مراجع vendor: [proxy-addr advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)، [body-parser advisory](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828).

## SEC-006 — HTTP و log

- شواهد مبنا: `src/app.ts:34–36` parser عمومی ۶MB و urlencoded، بدون Helmet/CSP؛ `ops/nginx-varsa.conf` فقط nosniff. logger قبلی بدنه را ثبت نمی‌کرد و serializer query را حذف می‌کرد؛ نشت راز در log اثبات نشده است.
- اصلاح: Helmet، no-store مدیر، CORS محدود، JSON معمول ۱۲۸KiB و image فقط ۶MiB، timeoutهای socket/request/proxy، پاسخ خطای ثابت و 404JSON؛ Secure production/HttpOnly. theme script به فایل خودی منتقل شد؛ CSP با script-src self در Nginx و preview قرار گرفت. style inline برای React/framer-motion محدود به style-src باقی است؛ unsafe-inline برای script وجود ندارد. فونت Google و تصاویر HTTPS واقعی در policy پوشش دارند.
- trust proxy قبلاً IP صریح داشت و حفظ شد؛ Nginx نمونه forwarded headers را overwrite می‌کند. HSTS عمداً فعال نشده است. نبود پیاده‌سازی TLS در Node ضعف قطعی محسوب نشده؛ پاسخ‌دهندهٔ واقعی Nginx است.
- وضعیت policy واقعی در میزبان نهایی باید پس از انتخاب دامنه با مرورگر و curl تأیید شود.

## SEC-007 — میزبان و نقش دیتابیس

- دامنه، TLS، IP پراکسی، firewall، bucket policy، دیتابیس غیرعمومی، ظرفیت و backup معلوم نیست؛ مالک صریحاً نامشخص بودن را تأیید کرد. هیچ تنظیم عملیاتی ادعا نمی‌شود.
- کد production اکنون secrets/مبدأ HTTPS/provider HTTPS/نبود dev OTP و رمز مشترک قدیمی را بررسی می‌کند؛ نقش superuser، BYPASSRLS، schema owner و دارای CREATE در startup رد می‌شود. نمونهٔ systemd غیرroot و محدود به منابع است.
- نقش owner migration از runtime جداست؛ runtime مجوز ساخت مدیر، schema یا خواندن migration ledger ندارد؛ audit فقط INSERT است. سیاست bucket باید private و دسترسی فقط server credential باشد، حتی objectهای منطقی public فقط از API ارائه شوند.
- وضعیت: نیازمند تنظیم میزبان؛ دستورها در deployment.md. تا انجام پذیرش میزبان، انتشار تأیید نشده است.

## SEC-008 — تغییر شماره و بازیابی مشتری

- تغییر مستقیم phone در profile پذیرفته نمی‌شد؛ نبود مسیر امن تغییر شماره نقص قابلیت موردنیاز بود، نه IDOR اثبات‌شده.
- مسیر جدید نیازمند نشست فعلی و OTP معتبر هر دو شمارهٔ قدیم/جدید است؛ تلاش‌ها محدود، کدها یک‌بارمصرف و نشست‌های قبلی باطل می‌شوند. شمارهٔ متعلق به حساب دیگر هرگز merge نمی‌شود. سفارش‌های قدیمی به هویت حساب متصل می‌مانند.
- گم شدن دسترسی به شماره مسیر عمومی خودکار ندارد: بررسی انسانی با احراز مستقل هویت، ثبت audit و ابطال نشست لازم است. کد/راز واقعی در chat درخواست نمی‌شود. جزئیات روند در deployment.md.

## SEC-009 — موارد بررسی‌شده و ردشده با شواهد

- مالکیت سفارش: `owns` و `customer_order_links` با customerId از نشست؛ claim مهمان به شمارهٔ تأییدشده و کد تصادفی سفارش نیاز دارد؛ شناسهٔ ارسالی مالکیت تعیین نمی‌کند.
- تیکت/پیوست: query هم‌زمان customerId و resourceId را شرط می‌کند؛ attachments و fileService مالک را بررسی می‌کنند؛ مسیر public خواندن private را رد می‌کند.
- آدرس در profile مشتری احرازشده تغییر می‌کند؛ حتی یک address ID یکسان در دو حساب، منابع جدا دارد.
- queryهای بررسی‌شده Drizzle/sql پارامتری هستند؛ مسیر SQL injection قابل دسترسی اثبات نشد. HTML metadata escape می‌شود؛ مقاله با parser بلوک و React render می‌شود؛ XSS عمومی اثبات نشد.
- قیمت، coupon و موجودی در سرور و تراکنش بررسی می‌شوند. تست PostgreSQL فروش آخرین واحد، retry هم‌زمان، سقف کوپن و لغو/expiry حفظ شده است. بدون شکست این تست‌ها، گزارش فساد موجودی صادر نمی‌شود.

## SEC-010 — ریسک محدود ابزار توسعه

- S3rver devDependency به loopback تست محدود است: dicer و fast-xml-parser قدیمی. در built API/worker import نمی‌شود و هیچ listener عمومی برای آن تنظیم نشده است. نسخهٔ سازگار اصلاح‌شدهٔ parser v3 وجود ندارد؛ تغییر کور به API v5 انجام نشده است.
- brace-expansion 5.0.8 در typedoc/codegen به patch سازگار 5.0.12 منتقل شد و codegen دوباره موفق شد؛ این مورد دیگر در استثناها نیست.
- severity ابزار، شدت تهدید محصول نیست؛ این موارد residual پایین برای محیط توسعهٔ trusted هستند. اگر emulator/codegen ورودی خارجی بپذیرد، این پذیرش اعتبار ندارد و CI باید fail کند. allowlist CI به advisory، version و مسیر دقیق محدود و دارای تاریخ بازبینی است.

## SEC-011 — بررسی اسرار

- Gitleaks 8.30.1 از release رسمی با بررسی SHA256 دریافت شد. هیچ مقدار مشکوکی در گزارش چت چاپ نشد.
- تطبیق `src/lib/customer.tsx:11` ثابت `varsa_guest_favorites_v1` است، نه API key؛ استثنای regex دقیق فقط همان خط اضافه شد.
- تطبیق `.env` محلی فرانت، `VITE_SUPABASE_ANON_KEY` قدیمی با claim `role=anon` است؛ مرورگر فعال دیگر Supabase را import نمی‌کند. این فایل کاربر حفظ شده است. کلید service_role نبود؛ استثنای کلی JWT یا .env به scanner اضافه نشد.
- فایل‌های env عملیاتی و تاریخچهٔ Git در این پوشه قابل بررسی کامل نیستند؛ اسکن history با CI پس از قرارگیری در Git انجام می‌شود. هر راز واقعی که قبلاً منتشر شده باشد باید در provider rotate شود؛ حذف از فایل به‌تنهایی کافی نیست.

## SEC-012 — بدنهٔ بزرگ پیش از احراز هویت

- شاهد: parser اولیهٔ `src/app.ts` پیش از router روی بدنهٔ upload تا ۶MiB اجرا می‌شد. داشتن یک CSRF token عمومی اجازهٔ ورود نبود، ولی مهاجم API می‌توانست بدنه‌های بزرگ را پیش از رسیدن به 401 در حافظه parse کند.
- شرط سوءاستفاده: دسترسی HTTP عمومی، دریافت CSRF pair خود مهاجم و ارسال هم‌زمان JSONهای بزرگ؛ ورود یا مالکیت شماره لازم نبود. اثر: فشار حافظه و احتمال restart در محدودیت process.
- اصلاح اجراشده: `beforeApiBody` در `src/routes/orders.ts` پیش از parser، نشست مدیر/مشتری و سهمیهٔ حساب/شبکه/کل را برای هر دو upload بررسی می‌کند. حساب کامل مدیر برای مسیر admin لازم است؛ enrollment مجوز upload نیست. مسیر private حساب مشتری را از نشست می‌گیرد.
- شاهد تست: deployment verifier روی API ساخته‌شده برای هر دو مسیر، JSON خراب و بدنهٔ ۷MiB بدون نشست را با 401 رد می‌کند؛ این درخواست‌ها به parser نمی‌رسند. نتیجهٔ `uploadsAuthenticateBeforeBodyParsing` در گزارش smoke ثبت است.

