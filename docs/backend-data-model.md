# مدل داده و منابع حقیقت

| داده | جدول / قرارداد |
|---|---|
| هویت محصول | `commerce_products`؛ نام جدا از بستهٔ قابل فروش |
| بستهٔ قابل فروش | `product_variants`؛ ID و slug قبلی، SKU یکتا، FK محصول، price صحیح IRT، weight_mg صحیح |
| موجودی | `inventory.available`؛ null یعنی بدون شمارش، عدد نامنفی یعنی قابل رزرو؛ version برای فرم قدیمی پنل |
| رزرو و گردش | `inventory_reservations` و `inventory_movements`؛ generation هر بازفعال‌سازی را متمایز می‌کند |
| سفارش | `orders`؛ ID و شمارهٔ قبلی، کلید idempotency یکتا و fingerprint درخواست |
| اقلام و مبالغ تاریخی | `order_items.snapshot` و `order_details.meta/address_snapshot`؛ نام، SKU، وزن، قیمت، تخفیف، ارسال و آدرس هنگام ثبت |
| وضعیت‌ها | order status در orders؛ payment و fulfillment مستقل در order_details؛ پیش‌فرض manual/unpaid |
| پرداخت آینده | چند `payment_attempts` برای یک سفارش؛ هیچ درگاهی اجرا نشده است |
| تخفیف | `coupons` و `coupon_redemptions`؛ code یکتا و یک redemption برای هر سفارش |
| محتوا | `content_entries` با kind مقاله/بنر؛ slug مقاله یکتا؛ payload برای محتوای منعطف |
| تنظیمات | `store_config`؛ revision فقط برای ویرایش مدیریت، checkout آن را قفل نمی‌کند |
| مشتری | `customers.profile` فقط مشخصات منعطف و رضایت پیامک؛ `customer_addresses` و `customer_favorites` مستقل |
| مالکیت سفارش | `customer_order_links`؛ هر سفارش فقط یک مالک |
| پشتیبانی/مرجوعی | `customer_cases`، پیام‌های مستقل `case_messages` و مشخصات فایل `stored_files` |
| اعلان | `customer_notifications` برای پنل؛ `outbox` برای اجرای پایدار worker |
| فایل | `stored_files` برای مالک، visibility، key، MIME، size و SHA-256؛ bytes در S3 |
| تماس | `contact_messages_api`؛ فقط API دسترسی دارد |
| مهاجرت | `schema_migrations` و marker داده در store_config |

نام `commerce_products` از برخورد با جدول `products` قدیمی Supabase جلوگیری می‌کند.
چون رابطهٔ والد تاریخی قابل اتکا وجود ندارد، هر بستهٔ قدیمی فعلاً والد مستقل
`legacy:<id>` می‌گیرد؛ نام و وزن برای ادغام حدسی محصولات استفاده نمی‌شود.
یک محصول می‌تواند بعداً چند variant داشته باشد و ID بسته تغییر نکند.

واحد پول ذخیره‌سازی IRT (تومان) است. نمایش Product JSON-LD طبق قرارداد موجود به
IRR تبدیل می‌شود؛ gateway آینده باید تبدیل مستقل و بررسی overflow داشته باشد.
وزن نمایشی قدیمی حفظ می‌شود؛ گرم = ۱۰۰۰ mg و مثقال ایرانی = ۴۶۰۸ mg است. واحد
ناشناخته یا وزن با دقت کمتر از mg باعث توقف migration/ویرایش می‌شود.

سفارش‌های قدیمی وزن هنگام خرید را ذخیره نکرده‌اند؛ migration آن را از محصول
امروز جعل نمی‌کند: `weightMg=null` و `legacyWeightUnknown=true` ثبت می‌شود.
نام و قیمت واقعی موجود در سفارش حفظ می‌شود. سفارش جدید snapshot کامل می‌گیرد.
ستون JSON `orders.items` فقط snapshot سازگار با API قبلی است و همراه با
`order_items` در همان تراکنش ایجاد می‌شود؛ محصول امروز آن را بازنویسی نمی‌کند.

حذف یا تغییر دادهٔ اصلی محصول، coupon یا موجودی با FK، unique و check محدود شده
است. stock منفی، قیمت منفی، quantity غیرمثبت و visibility خصوصی بدون مالک رد
می‌شوند. یک آدرس پیش‌فرض برای هر مشتری با unique index جزئی اعمال می‌شود.
درخواست مرجوعی/لغو باز و تکراری نیز unique index دارد. کلیدهای خارجی پرتکرار
index دارند. دسترسی مرورگر به جدول‌ها داده نمی‌شود؛ کنترل مالکیت در API است.

سند `store_management`، فایل Base64 قدیمی و جدول قدیمی محصولات، پس از backfill
منابع اجرا نیستند. مسیرهای فایل برای گذار، bytes قدیمیِ هنوزمنتقل‌نشده را پس از
کنترل دسترسی می‌خوانند؛ پس از وجود نگاشت، فقط S3 خوانده می‌شود و خرابی S3 به
fallback خاموش به نسخهٔ قدیمی منجر نمی‌شود.

تراکنش checkout: تعیین تکلیف کلید یکتا، قفل variantهای درخواستی با ترتیب ID،
قفل inventory همان ردیف‌ها، قفل coupon انتخابی، قیمت‌گذاری مجدد، درج snapshot،
رزرو/گردش، redemption و outbox. لغو/انقضا ابتدا سفارش را قفل می‌کنند و فقط
رزرو reserved را آزاد می‌کنند. هیچ قفل سند مشترکی در این مسیر وجود ندارد.

بازطراحی UI و مهاجرت کامل SSR/SSG جزو این تغییر نیست. build متادیتای موجود حفظ
شده و منبع خواندن آن به API منتقل شده است؛ بررسی SSR/SSG می‌تواند تصمیم جداگانه‌ای
پس از انتخاب میزبان و نیازهای SEO باشد.
