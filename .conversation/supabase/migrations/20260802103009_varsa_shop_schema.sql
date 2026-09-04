/*
# Varsa — لوکس زعفران فروشگاهی (schema)

این مایگریشن ساختار پایگاه‌داده‌ی فروشگاه برند «ورسا» را می‌سازد.

1. جداول جدید
- `products`: کاتالوگ محصولات زعفران (نگین، سرگل، پوشال، رشته، پک هدیه) با شاخص‌های
  کیفی ISO 3632 (کروسین، پیکروکروسین، سافرانال)، وزن خالص، قیمت و تصویر.
  ستون is_featured برای نمایش در صفحه نخست و sort_order برای ترتیب نمایش.
- `articles`: پست‌های مجله‌ی «دلگشا» با عنوان، خلاصه، محتوای کامل، تصویر، نویسنده
  و زمان تخمینی مطالعه.
- `contact_messages`: پیام‌های ارسال‌شده از فرم تماس با ما.

2. امنیت (تک‌مستاجری، بدون ورود)
- `products`: خواندن عمومی برای anon + authenticated؛ نوشتن فقط برای authenticated
  (مدیریت ادمین؛ داده‌ها با نقش service role که از RLS می‌گذرد، seed می‌شوند).
- `articles`: خواندن عمومی؛ نوشتن فقط برای authenticated.
- `contact_messages`: هر کسی (anon + authenticated) می‌تواند پیام ثبت کند (INSERT)؛
  خواندن/ویرایش/حذف فقط برای authenticated (مخصوص ادمین). پیام‌ها در front-end نمایش
  داده نمی‌شوند تا حریم خصوصی مخاطب حفظ شود.
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('نگین','سرگل','پوشال','رشته','هدیه')),
  short_description text NOT NULL,
  long_description text,
  crocin numeric NOT NULL DEFAULT 0,
  picrocrocin numeric NOT NULL DEFAULT 0,
  safranal numeric NOT NULL DEFAULT 0,
  weight numeric NOT NULL DEFAULT 0,
  weight_unit text NOT NULL DEFAULT 'گرم',
  price numeric NOT NULL DEFAULT 0,
  image_url text NOT NULL,
  is_featured boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products"
ON products FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_products" ON products;
CREATE POLICY "auth_insert_products"
ON products FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_products" ON products;
CREATE POLICY "auth_update_products"
ON products FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_products" ON products;
CREATE POLICY "auth_delete_products"
ON products FOR DELETE
TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  excerpt text NOT NULL,
  content text NOT NULL,
  image_url text NOT NULL,
  author text NOT NULL DEFAULT 'تحریریه ورسا',
  category text NOT NULL,
  read_time int NOT NULL DEFAULT 5,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_articles" ON articles;
CREATE POLICY "public_read_articles"
ON articles FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_articles" ON articles;
CREATE POLICY "auth_insert_articles"
ON articles FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_articles" ON articles;
CREATE POLICY "auth_update_articles"
ON articles FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_articles" ON articles;
CREATE POLICY "auth_delete_articles"
ON articles FOR DELETE
TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_messages" ON contact_messages;
CREATE POLICY "auth_read_messages"
ON contact_messages FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_messages" ON contact_messages;
CREATE POLICY "public_insert_messages"
ON contact_messages FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_messages" ON contact_messages;
CREATE POLICY "auth_update_messages"
ON contact_messages FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_messages" ON contact_messages;
CREATE POLICY "auth_delete_messages"
ON contact_messages FOR DELETE
TO authenticated USING (true);
