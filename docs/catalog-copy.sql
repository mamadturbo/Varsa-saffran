-- Catalog text review only: run in the Supabase products database in a transaction.
-- Exact original text and product identity/specifications guard each row.
-- Review affected rows before COMMIT. Changed/custom text is preserved.
-- Does not change prices, weights, images, lab values or order records.

UPDATE public.products SET short_description = 'زعفران نگین ورسا در بسته یک گرمی؛ وزن و قیمت بسته را با دیگر گزینه‌های نگین مقایسه کنید.', long_description = 'این محصول با نام زعفران نگین ورسا و وزن خالص یک گرم در کاتالوگ عرضه می‌شود. برای انتخاب مقدار مناسب، بسته‌های دیگر دسته نگین را نیز ببینید.'
WHERE id::text = 'fd06cca4-3787-4444-9b4f-ff1646de8860' AND slug = 'negin-1g' AND name = 'زعفران نگین ورسا ۱ گرمی'
  AND category = 'نگین' AND weight = 1 AND weight_unit = 'گرم'
  AND short_description IS NOT DISTINCT FROM 'بلندترین رتبه‌ی زعفران؛ همه‌ی کلاله‌ها تماماً قرمز، بدون هیچ زردی. عطر نفیس و رنگ بی‌نظیر.'
  AND long_description IS NOT DISTINCT FROM 'زعفران نگین ورسا از دست‌چین‌ترین کلاله‌های مزارع کویر به دست می‌آید؛ جایی که هر گل تنها یک‌بار و در سایه‌ی سپیده‌دم چیده می‌شود. نگین بالاترین درجه‌ی زعفران است؛ کلاله‌ها تماماً قرمز، ضخیم و بدون بخش زردی، و به همین دلیل بالاترین میزان کروسین (رنگ)، پیکروکروسین (طعم) و سافرانال (عطر) را داراست. بسته‌بندی فلزی اختصاصی ورسا با درب دوگانه، عطر و رطوبت را تا لحظه‌ی مصرف حفظ می‌کند.';

UPDATE public.products SET short_description = 'زعفران نگین ورسا در بسته دو گرمی؛ گزینه‌ای با وزن بیشتر از بسته یک گرمی این دسته.', long_description = 'این بسته حاوی دو گرم زعفران نگین ورساست. وزن خالص و قیمت آن را با بسته یک گرمی نگین مقایسه کنید و متناسب با مصرف خود انتخاب کنید.'
WHERE id::text = 'b2038836-1243-4ab3-a2e2-9083904f744f' AND slug = 'negin-2g' AND name = 'زعفران نگین ورسا ۲ گرمی'
  AND category = 'نگین' AND weight = 2 AND weight_unit = 'گرم'
  AND short_description IS NOT DISTINCT FROM 'همان کیفیت نگین بی‌نقص در بسته‌ی بزرگ‌تر؛ انتخابی ماندگار برای سفره‌های پرعطر.'
  AND long_description IS NOT DISTINCT FROM 'نگین ۲ گرمی ورسا، همان زعفران تماماً قرمز و دست‌چین‌شده را در حجمی متناسب با مصرف خانواده‌ها و سرآشپزان حرفه‌ای عرضه می‌کند. هر بسته با گواهی آنالیز آزمایشگاهی همراه است.';

UPDATE public.products SET short_description = 'زعفران سرگل ورسا در بسته یک گرمی؛ برای مقایسه با بسته دو گرمی همین دسته.', long_description = 'این محصول با نام زعفران سرگل ورسا و وزن خالص یک گرم در کاتالوگ ثبت شده است. هنگام انتخاب، وزن و قیمت بسته‌های سرگل را کنار هم بررسی کنید.'
WHERE id::text = '76cd4135-b4b5-4540-aa4f-6636f4d26b87' AND slug = 'sargol-1g' AND name = 'زعفران سرگل ورسا ۱ گرمی'
  AND category = 'سرگل' AND weight = 1 AND weight_unit = 'گرم'
  AND short_description IS NOT DISTINCT FROM 'برش‌های ریز و تماماً قرمز کلاله؛ عطر تند و رنگی که با کمترین میزان، چشم‌گیر می‌شود.'
  AND long_description IS NOT DISTINCT FROM 'سرگل ورسا از جدا کردن بخش زردی کلاله به دست می‌آید و تنها نوک قرمز و پرعطر را در خود جای می‌دهد. تفاوت آن با نگین در ضخامت رشته‌هاست؛ سرگل ریزتر و شکننده‌تر است اما عطر و رنگی درخشان دارد.';

UPDATE public.products SET short_description = 'زعفران سرگل ورسا در بسته دو گرمی؛ برای انتخاب متناسب با میزان مصرف شما.', long_description = 'این بسته حاوی دو گرم زعفران سرگل ورساست. اگر به مقدار بیشتری از بسته یک گرمی نیاز دارید، وزن و قیمت این دو گزینه را مقایسه کنید.'
WHERE id::text = '90527f59-962b-4d8b-883a-9ef011fedf03' AND slug = 'sargol-2g' AND name = 'زعفران سرگل ورسا ۲ گرمی'
  AND category = 'سرگل' AND weight = 2 AND weight_unit = 'گرم'
  AND short_description IS NOT DISTINCT FROM 'سرگل پرعطر در حجمی برای پخت‌وپز روزمره‌ی اصیل.'
  AND long_description IS NOT DISTINCT FROM 'سرگل ۲ گرمی ورسا برای آن دسته از خانم‌های خانه‌دار خوش‌سلیقه است که عطر کویر را در پخت‌وپز روزانه‌ی خود زنده نگه می‌دارند.';

UPDATE public.products SET short_description = 'زعفران پوشال ورسا در بسته دو گرمی؛ مشخصات و قیمت این بسته را پیش از انتخاب ببینید.', long_description = 'این محصول با نام زعفران پوشال ورسا و وزن خالص دو گرم در کاتالوگ عرضه می‌شود. برای مقایسه با دیگر دسته‌ها، وزن، قیمت و توضیحات همان محصول را بررسی کنید.'
WHERE id::text = 'a2cd33cc-cb9f-40da-b1c2-3209719e20ed' AND slug = 'poshal-2g' AND name = 'زعفران پوشال ورسا ۲ گرمی'
  AND category = 'پوشال' AND weight = 2 AND weight_unit = 'گرم'
  AND short_description IS NOT DISTINCT FROM 'رشته‌های کامل کلاله با اندکی بخش زردی؛ نمایشی طبیعی و عطرSoft افسانه‌ای.'
  AND long_description IS NOT DISTINCT FROM 'پوشال ورسا رشته‌های کامل کلاله را با بخش زردی کوتاه نمایش می‌دهد؛ ظاهری طبیعی‌تر و عطری نرم‌تر از نگین و سرگل. برای دم‌کردن‌های طولانی و رنگ‌دهی ملایم ایده‌آل است.';

UPDATE public.products SET short_description = 'زعفران رشته ورسا در بسته دو گرمی؛ یکی از دسته‌های موجود در فروشگاه ورسا.', long_description = 'این محصول با نام زعفران رشته ورسا و وزن خالص دو گرم در کاتالوگ ثبت شده است. نام دسته به‌تنهایی برای مقایسه کیفیت کافی نیست؛ مشخصات هر محصول را جداگانه بررسی کنید.'
WHERE id::text = '287995dd-4f31-4d70-8327-ace382913419' AND slug = 'reshteh-2g' AND name = 'زعفران رشته ورسا ۲ گرمی'
  AND category = 'رشته' AND weight = 2 AND weight_unit = 'گرم'
  AND short_description IS NOT DISTINCT FROM 'کلاله‌ی کامل از نوک قرمز تا انتها؛ تصویری اصیل از زعفران سنتی.'
  AND long_description IS NOT DISTINCT FROM 'زعفران رشته ورسا، همان کلاله‌ی کامل است که از گل جدا شده و با تمام بخش‌های قرمز و زرد عرضه می‌شود. این نوع، نمایشی سنتی و طبیعی از زعفران است و برای کسانی که با چشم خود می‌خواهند اصالت زعفران را ببینند، انتخابی شایسته است.';

UPDATE public.products SET short_description = 'پک هدیه لوکس ورسا با زعفران نگین یک گرمی، قاشق چوبی و کارت تبریک در جعبه مخمل‌پوش.', long_description = 'محتویات درج‌شده برای این پک در کاتالوگ شامل زعفران نگین یک گرمی، قاشق چوبی و کارت تبریک در جعبه مخمل‌پوش است. وزن اعلام‌شده مربوط به زعفران است؛ قیمت نمایش‌داده‌شده، قیمت کل پک هدیه است.'
WHERE id::text = '7bfd2e7c-da89-435d-b5e9-8b522324b9c0' AND slug = 'gift-set-luxe' AND name = 'پک هدیه لوکس ورسا'
  AND category = 'هدیه' AND weight = 1 AND weight_unit = 'گرم'
  AND short_description IS NOT DISTINCT FROM 'جعبه‌ی مخمل‌پوش با نگین ۱ گرمی، قاشق چوبی و کارت مخصوص؛ هدیه‌ای ماندگار.'
  AND long_description IS NOT DISTINCT FROM 'پک هدیه‌ی لوکس ورسا برای مناسبت‌های خاص طراحی شده است؛ جعبه‌ی مخمل‌پوش دربرگیرنده‌ی زعفران نگین ۱ گرمی، قاشق چوبی اختصاصی و کارت تبریک با نقوش اسلیمی. بسته‌بندی فلزی داخل جعبه عطر را تا لحظه‌ی هدیه‌دادن حفظ می‌کند.';

UPDATE public.products SET short_description = 'پک هدیه امضای ورسا با دو بسته نگین و سرگل در جعبه چوبی؛ وزن کل زعفران سه گرم.', long_description = 'طبق کاتالوگ، این پک شامل دو بسته زعفران نگین و سرگل در جعبه چوبی حکاکی‌شده است. وزن کل زعفران سه گرم و قیمت نمایش‌داده‌شده مربوط به کل پک است؛ وزن جداگانه هر بسته در کاتالوگ مشخص نشده است.'
WHERE id::text = 'ac38599c-4285-44ec-bba9-1ac4b48a8e85' AND slug = 'gift-set-signature' AND name = 'پک هدیه امضای ورسا'
  AND category = 'هدیه' AND weight = 3 AND weight_unit = 'گرم'
  AND short_description IS NOT DISTINCT FROM 'دو بسته‌ی نگین و سرگل در جعبه‌ی چوبی حکاکی‌شده؛ عطر کویر در قالبی هنری.'
  AND long_description IS NOT DISTINCT FROM 'پک هدیه امضای ورسا، ترکیبی از زعفران نگین و سرگل را در جعبه‌ای چوبی با حکاکی‌های اسلیمی عرضه می‌کند. این پک، انتخابی اشرافی برای هدایای سازمانی و مناسبت‌های مهم است.';
