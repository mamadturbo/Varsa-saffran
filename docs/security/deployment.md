# راه‌اندازی و پذیرش امنیتی ورسا

این راهنما برای **استقرار بعدی و با اجازهٔ جداگانهٔ مالک** است. در این کار فقط محیط محلی آزمایش شده است. دامنه، میزبان و پراکسی واقعی هنوز انتخاب نشده‌اند؛ TLS، فایروال، bucket و backup عملیاتی اجراشده فرض نمی‌شوند.

## پیش از انتقال

1. نسخهٔ پشتیبان رمزگذاری‌شده از PostgreSQL، object storage و env/کلید MFA را در محل جدا نگه دارید و بازیابی را روی یک دیتابیس تازه تمرین کنید. بدون ADMIN_MFA_KEY قبلی، secrets TOTP قابل رمزگشایی نیستند؛ تعویض کور کلید به قفل‌شدن مدیر منجر می‌شود.
2. سرویس API/worker را برای migration و انتقال مدیر متوقف کنید یا یک پنجرهٔ نگهداری مشخص داشته باشید. توکن‌های Bearer قدیمی عمداً پذیرفته نمی‌شوند؛ rollout هماهنگ backend و frontend لازم است.
3. Node 24، pnpm دقیقاً طبق packageManager و lockfile را روی ماشین build آماده کنید. native modules Argon2/Sharp باید برای **سیستم مقصد** نصب شوند؛ node_modules ویندوز را به Linux منتقل نکنید. نصب build toolchain باید در محیط build غیرعملیاتی باشد.
4. `pnpm install --frozen-lockfile`، `node scripts/security-audit.mjs`، typecheck، تست و build را روی همان release انجام دهید. devDependencies فقط در build/test استفاده می‌شوند؛ S3rver، tsx، Vite dev server و ابزار اسکن روی اینترنت منتشر نشوند.

خروجی dist موجود، خروجی **اعتبارسنجی با دامنه و دادهٔ آزمایشی** است؛ آن را مستقیماً منتشر نکنید. برای release واقعی، VITE_SITE_URL را دامنهٔ HTTPS نهایی، METADATA_API_URL را API خواندنیِ مربوط به همان کاتالوگ و SEO_REQUIRE_COMPLETE=1 قرار دهید و دوباره build کنید. هیچ secret خصوصی با پیشوند VITE_ تنظیم نشود. `verify:deployment` عمداً frontend را با fixture مستقل بازسازی می‌کند؛ پس از آن برای انتشار، build مقصد لازم است.

## نقش‌های PostgreSQL

Migration با نقش schema owner مجزا اجرا شود. نقش runtime نباید superuser، BYPASSRLS، CREATEROLE، CREATEDB، owner جدول‌ها یا دارای CREATE روی schema باشد. startup production این موارد را بررسی می‌کند. DB فقط روی loopback یا شبکهٔ خصوصی listen کند؛ پورت 5432 در اینترنت باز نشود.

نمونهٔ provision، فقط با اتصال اپراتور و پس از انتخاب میزبان:

```sql
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE ROLE varsa_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE varsa_runtime LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT varsa_api TO varsa_runtime;
```

رمز نقش login با `\password varsa_runtime` در psql و کانال امن تعیین شود؛ رمز واقعی در فایل SQL، command history یا chat قرار نگیرد. نقش migration را به runtime grant نکنید. PUBLIC/anon/authenticated نباید به جدول‌های امنیتی دسترسی داشته باشند؛ روی دیتابیس میزبان، default privileges و عضویت نقش‌ها را هم بررسی کنید.

پس از **اجازهٔ migration عملیاتی**، با اتصال owner صریح و بدون بارگیری .env ضمنی:

```sh
cd /opt/varsa/current/artifacts/api-server
# DATABASE_URL در shell محدود اپراتور، مربوط به owner مقصد تأییدشده است.
MIGRATION_TARGET_ACK=isolated-or-approved node dist/migrate-commerce.mjs
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../../ops/database-runtime-grants.sql
```

برای دیتابیس موجود `--seed-empty` اضافه نکنید. تغییر checksum migrationهای اعمال‌شده مجاز نیست. migration جدید `0010_security.sql` افزایشی است؛ داده‌های سفارش و فایل قدیمی را حذف نمی‌کند. بازگشت امن از خطای rollout یعنی حفظ جداول جدید، توقف سرویس، رفع مشکل و rollout مجدد؛ بازگرداندن مدل رمز مشترک راه بازگشت قابل قبول نیست.

## اسرار و پیکربندی production

`/etc/varsa/api.env` با owner مناسب و دسترسی 0600 خارج از document root باشد. `NODE_ENV=production` در unit هم تثبیت شده است. نمونهٔ کلیدها در `artifacts/api-server/.env.example` است.

- SESSION_SECRET و CUSTOMER_AUTH_SECRET: دو مقدار تصادفی **مستقل** با حداقل ۳۲ نویسه؛ نمونهٔ placeholder را در production استفاده نکنید.
- ADMIN_MFA_KEY: دقیقاً ۳۲ بایت تصادفی به شکل ۶۴ رقم hex. فقط روی میزبان API و backup رمزگذاری‌شدهٔ اسرار نگه دارید. `node:crypto.randomBytes(32)` برای تولید مناسب است؛ خروجی را مستقیماً در فایل محدود بنویسید، نه در log یا chat.
- PUBLIC_ORIGIN: origin اصلی و دقیق HTTPS، بدون path، credentials، query یا wildcard. بهترین topology، storefront و `/api` روی همان origin پشت Nginx است.
- ALLOWED_ORIGINS و CUSTOMER_ALLOWED_ORIGINS: خالی یا فقط originهای واقعاً لازم و trusted. wildcard یا reflection مبدأ مجاز نیست. برای سایت هم‌مبدأ، PUBLIC_ORIGIN کافی است.
- TRUSTED_PROXY_IPS: فقط IP دقیق پراکسی بلافصل. پیش‌فرض empty یعنی بی‌اعتمادی به forwarded headers. API با BIND_HOST=127.0.0.1 پشت Nginx همان میزبان قابل استفاده است؛ در container فقط شبکهٔ خصوصی و firewall مناسب را انتخاب کنید.
- CUSTOMER_SMS_URL و S3_ENDPOINT: HTTPS با اعتبارسنجی certificate؛ URL نباید credentials/query secrets داشته باشد. tokenها در متغیر جدا و header منتقل می‌شوند. CUSTOMER_SMS_TOKEN و کلیدهای S3 فقط backend هستند.
- CUSTOMER_AUTH_DEV_OTP=false و حذف کامل VARSA_ADMIN_PASSWORD الزامی است؛ production با این bypass/مدل قدیمی start نمی‌شود.
- SMS_HOURLY_LIMIT=200 و SMS_DAILY_LIMIT=1000 پیش‌فرض محافظه‌کارانه هستند؛ متناسب با فروش واقعی تغییر دهند. این‌ها سقف تلاش ارسال provider هستند، نه صورتحساب تحویل.
- UPLOAD_ACCOUNT_BYTES=104857600 و UPLOAD_TOTAL_BYTES=10737418240. فایل جدید حداکثر ۴MiB، یک frame، ابعاد هر طرف ۶۰۰۰ و ۱۶M پیکسل دارد.

startup خطای تنظیم را با نام کنترل اعلام می‌کند و مقدار راز را چاپ نمی‌کند. readiness باید با نقش runtime و bucket قابل دسترسی موفق شود. ExecStart واحدهای production، مقدار NODE_ENV=production را با `/usr/bin/env` روی خود process تحمیل می‌کند؛ کپی‌شدن NODE_ENV=development از env نمونه، کنترل‌ها و Secure cookie را خاموش نمی‌کند. ساعت میزبان و دستگاه TOTP باید با منبع زمان معتبر همگام باشند.

## انتقال مدیر قبلی و راه‌اندازی MFA

رمز مشترک قبلی به صورت خودکار import نمی‌شود. اپراتور برای مدیر مشخص یک رمز جدید حداقل ۱۴ نویسه‌ای تعیین می‌کند. حساب از HTTP عمومی ساخته نمی‌شود.

در shell اپراتور روی میزبان امن، یک فایل موقت محدود برای رمز ایجاد کنید. نمونهٔ Linux؛ دستور هیچ رمز literal در history قرار نمی‌دهد:

```sh
umask 077
read -rsp 'New admin password: ' varsa_admin_password
printf '%s' "$varsa_admin_password" > /run/varsa-admin-password
unset varsa_admin_password
export ADMIN_PASSWORD_FILE=/run/varsa-admin-password
export ADMIN_OPERATOR_ACK=explicit-target-approved
# DATABASE_URL این مرحله اتصال owner تأییدشده است، نه credential runtime برنامه.
node dist/admin-account.mjs create owner-admin
rm -- /run/varsa-admin-password
unset ADMIN_PASSWORD_FILE ADMIN_OPERATOR_ACK
```

روی Windows از فایل موقت با ACL محدود و همان متغیرها استفاده کنید؛ رمز را در argv یا فایل قابل اشتراک نگذارید. این فرمان در آزمون ایزوله اجرا شده است. runtime اجازهٔ INSERT در admin_accounts ندارد.

1. در origin اصلی `/admin`، نام کاربری و رمز تازه را وارد کنید. بار اول کد TOTP را خالی بگذارید.
2. هنوز دسترسی به پنل داده نمی‌شود؛ فقط نشست enrollment ده‌دقیقه‌ای صادر می‌شود. کلید نمایش‌داده‌شده را در authenticator معتبر وارد کنید؛ کلید را برای کسی ارسال نکنید.
3. کد شش‌رقمی برنامه را در مدت پنج دقیقه تأیید کنید. پیش از تأیید، TOTP فعال نیست؛ secret در DB رمزگذاری شده است.
4. ده recovery code یک‌بارمصرف را در password manager یا محل آفلاین جدا از authenticator ذخیره کنید؛ این صفحه فقط یک بار نمایش داده می‌شود. backend فقط hash آن‌ها را نگه می‌دارد.
5. خروج کنید؛ ورود بدون عامل دوم باید رد شود. ورود با TOTP معتبر و سپس خروج را امتحان کنید. استفادهٔ مجدد همان بازهٔ TOTP رد می‌شود؛ برای ورود مجدد تا کد جدید منتظر بمانید.
6. تغییر رمز و حذف عامل دوم در «تنظیمات → امنیت حساب مدیر» نیازمند رمز فعلی + TOTP یا recovery است. همهٔ نشست‌ها باطل می‌شوند. حذف MFA، مجوز ورود بدون MFA نمی‌دهد: ابتدا enrollment دوباره لازم است.

نشست کامل حداکثر ۸ ساعت و بعد از ۲۰ دقیقه بی‌فعالیتی تمام می‌شود. کوکی production Secure/HttpOnly/SameSite=Strict و محدود به `/api` است؛ هیچ session token در localStorage یا sessionStorage ذخیره نمی‌شود. در توسعهٔ محلی HTTP، Secure خاموش است؛ این رفتار به production قابل انتقال نیست.

## بازیابی مدیر

- رمز + recovery code مصرف‌نشده: مسیر همان صفحهٔ ورود است؛ استفادهٔ موفق کد را حذف و نشست‌های قبلی را باطل می‌کند. از recovery برای آزمون بی‌هدف استفاده نکنید؛ یک بار مصرف می‌شود.
- نداشتن رمز یا recovery یا دستگاه: احراز انسانی مالک و ورود امن اپراتور به میزبان، سپس همان فرایند فایل رمز و فرمان زیر. هیچ endpoint reset عمومی یا رمز اصلی مخفی وجود ندارد:

```sh
node dist/admin-account.mjs reset owner-admin
```

متغیرهای محدود و اتصال owner مانند create الزامی‌اند. فرمان رمز/MFA/recovery را reset می‌کند، تمام نشست‌ها را باطل می‌کند و audit `operator_recovery` می‌نویسد. مالک باید دوباره TOTP را ثبت و تأیید کند. فایل رمز موقت را بعد از کار حذف کنید. هشدار بی‌مورد در log را با بازگرداندن رمز مشترک رفع نکنید.

## تغییر شماره و بازیابی مشتری

شمارهٔ حساب با profile update تغییر نمی‌کند. قرارداد API امن:

1. نشست فعلی مشتری معتبر باشد؛ از `/api/csrf` توکن بگیرد و header `X-Varsa-CSRF` را همراه cookie بفرستد.
2. برای هر دو شمارهٔ قدیم و جدید از `/api/customer/auth/request` کد بخواهد؛ limiter و TTL دو دقیقه‌ای عادی اعمال می‌شود.
3. POST `/api/customer/auth/change-phone` با `{phone,oldCode,newCode}`. کدها باید متعلق به هر دو شماره باشند. سرور customerId یا مالکیت را از بدنه نمی‌پذیرد.
4. موفقیت، کدها و همهٔ نشست‌های قدیمی را باطل می‌کند؛ ورود مجدد با شمارهٔ جدید لازم است. ID حساب و سفارش‌های مرتبط حفظ می‌شوند. شمارهٔ حساب موجود هرگز خودکار merge نمی‌شود.

این مسیر API تست شده است؛ هنوز فرم جداگانهٔ تغییر شماره در UI مشتری اضافه نشده است. در فقدان شمارهٔ قدیم، پشتیبانی باید هویت را از مسیر مستقل تأیید کند؛ اطلاعات سفارش به‌تنهایی اثبات مالکیت کافی نیست. اپراتور تغییر را با transaction، کنترل یکتایی شماره، ابطال نشست و audit انجام دهد. قابلیت بازنشانی عمومی با تکیه بر شمارهٔ ارسالی یا customerId ایجاد نکنید. هیچ OTP واقعی در chat، تیکت یا log درخواست نشود.

## Nginx، TLS و فایل‌ها

- دامنه و certificate معتبر و تمدید خودکار باید توسط اپراتور انتخاب شوند. HTTP به همان دامنهٔ HTTPS redirect شود؛ تا تأیید دامنه‌ها HSTS فعال نشود.
- `ops/nginx-varsa.conf` داخل server HTTPS مناسب قرار می‌گیرد. `ops/nginx-security-headers.conf` را در `/etc/nginx/snippets/varsa-security-headers.conf` نصب کنید؛ Nginx واقعی HTML را ارائه می‌کند، بنابراین Helmet API به‌تنهایی برای صفحه کافی نیست.
- Nginx forwarded headers را overwrite می‌کند؛ API از اینترنت مستقیم قابل دسترسی نباشد. `/api` cache نشود؛ پاسخ فایل خصوصی حتی با CDN باید `private, no-store` باقی بماند. CDN برای `/api/customer/*` و `/api/admin/*` bypass باشد.
- S3 bucket باید private، بدون public ACL/list/get و با credential محدود همان bucket باشد. نام منطقی `public/` مجوز عمومی S3 نیست؛ تصاویر عمومی از `/api/media` با cache و خصوصی فقط با مالکیت از `/api/customer/media` ارائه می‌شوند. لینک امضاشدهٔ قابل انتشار ساخته نمی‌شود.
- CSP فعلی script-src self دارد. theme به فایل same-origin منتقل شده؛ style inline برای React/framer-motion، فونت Google و imgهای HTTPS موجود مجازند. اضافه‌کردن third-party script نیازمند بازبینی policy است. اتصال runtime فرانت فقط same-origin است.
- پس از نصب: `nginx -t`، بررسی header صفحهٔ اصلی و محصول/مدیر، دانلود غیرمجاز فایل خصوصی، login/logout و MFA در browser واقعی دامنه انجام شود. نتیجهٔ HTTPS واقعی در این کار قابل تأیید نبود.
- unitهای `ops/varsa-api.service` و worker از کاربر غیرroot و محدودیت حافظه/دسترسی استفاده می‌کنند. فقط 80/443 و SSH محدود به IP اپراتور باز شوند. S3/DB/metrics/emulator عمومی نباشند.

## هشدار، مصرف و نگهداری

- logهای ثابت `security_alert:sms_budget_exhausted` و افزایش `admin_login_failed`، rate-limitها، 503 و restartهای سرویس به monitoring میزبان متصل شوند. اتصال به سرویس پولی یا ارسال پیام در این کار انجام نشده است.
- audit فقط event، شناسهٔ مدیر و مسیر بدون IDهای resource دارد؛ رمز، OTP، session و body ذخیره نمی‌شوند. `mutation_requested` آغاز درخواست است، نه ادعای موفقیت؛ نتیجه با log status همان درخواست و audit تراکنشی auth تفسیر شود.
- شمارنده‌های security و نشست‌های منقضی توسط worker پاک می‌شوند. audit را با فرایند owner/backup و retention متناسب آرشیو کنید؛ runtime مجوز حذف audit ندارد.
- فایل رزروشده با شکست ارسال S3 ممکن است mapping بدون object داشته باشد. owner باید با head/checksum و توقف upload، این موارد را شناسایی و پس از تأیید فقط reservation واقعاً ناموفق را اصلاح کند؛ حذف خودکار تصاویر قدیمی مجاز نشده است.

## backup رمزگذاری‌شده و آزمون بازیابی

`pg_dump --format=custom` با credential owner backup محدود و channel امن، نسخه‌برداری objectها همراه checksum، سپس رمزگذاری با ابزار معتبر مانند age به public recipient اپراتور انجام شود. private key رمزگشایی backup روی میزبان runtime نگهداری نشود. snapshot اسرار با کلید مستقل و کنترل دسترسی جدا لازم است؛ session tokens hash هستند اما backup همچنان حساس است.

حداقل به صورت دوره‌ای روی محیط جدا: archive را رمزگشایی کنید، `pg_restore` به دیتابیس خالی غیرعمومی، فایل‌ها را restore و checksum کنید، migration ledger را بررسی کنید، API با نقش runtime و کلید MFA درست اجرا کنید، ورود مدیر/MFA/مالکیت فایل و صحت موجودی را تست کنید. رکورد زمان و نتیجه و RPO/RTO واقعی نگه دارید. این آزمون روی backup عملیاتی هنوز اجرا نشده؛ تست محلی migration با fixture جای آن نیست.

## معیار فعال‌سازی روی میزبان

اپراتور باید دامنه/TLS، نقش runtime، secretها، provider پیامک، private bucket، firewall، backup restore، هشدار بودجه و headerهای **پاسخ واقعی** را تأیید کند. آماده‌بودن کد محلی به معنی انتشار یا اجرای migration عملیاتی نیست. اگر هر کدام fail شد، سرویس عمومی نشود؛ بازکردن CORS، حذف CSRF یا پذیرش Bearer قدیمی راه‌حل نیست.

## Temporary operator-controlled password-only login

MFA remains required by default. The operator may explicitly set `ADMIN_PASSWORD_ONLY=true` in the protected API environment and restart the API to allow authenticated admin passwords without enrollment or TOTP. Existing encrypted MFA data is preserved. Password checks, CSRF, throttling, audit, secure cookies and session time limits stay in effect. The login and account-security UI read the server policy from login-options. Password-only session tokens are marked separately and stop resolving immediately when the flag is removed or set to false; resuming MFA does not leave those sessions valid. The flag is not accepted from request bodies or frontend settings.
