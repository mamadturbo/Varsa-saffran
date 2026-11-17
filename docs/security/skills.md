# اسکیل‌ها و منابع استفاده‌شده

در آغاز کار اسکیل-installer و دستورالعمل‌های موجود پروژه خوانده شدند؛ AGENTS.md در پوشهٔ پروژه و والدهای آن پیدا نشد. اسکیل به عنوان راهنما استفاده شد و نمونهٔ آمادهٔ JWT/رمز مشترک کپی نشد؛ پشتهٔ موجود Express/React/Drizzle/PostgreSQL حفظ شده است.

| اسکیل | وضعیت | منبع اصلی |
|---|---|---|
| security-best-practices | نصب شد | [openai/skills](https://github.com/openai/skills/tree/main/skills/.curated/security-best-practices) |
| security-threat-model | نصب شد | [openai/skills](https://github.com/openai/skills/tree/main/skills/.curated/security-threat-model) |
| auth-implementation-patterns | نصب شد | [wshobson/agents](https://github.com/wshobson/agents/tree/main/plugins/developer-essentials/skills/auth-implementation-patterns) |
| nodejs-backend-patterns | از قبل نصب بود؛ خوانده شد | wshobson/agents |
| supabase-postgres-best-practices | از قبل نصب بود؛ پیش از نوشتن SQL خوانده شد | supabase/agent-skills |

منابع مرتبط: راهنمای Express، JavaScript عمومی فرانت، React/TypeScript، قالب threat model، جزئیات auth/session/authorization، جزئیات middleware/validation Node.js، least privilege، RLS، indexهای WHERE/JOIN و تراکنش کوتاه Postgres. راهنمای UI/UX برای فرم‌های auth و computer-use برای اعتبارسنجی مرورگری نیز خوانده شد.

فرض‌های کسب‌وکار مطابق متن تأییدشدهٔ مالک پذیرفته شدند؛ توقف برای تأیید دوباره یا اجازهٔ اصلاح انجام نشد. تنها پرسش میزبان مطرح شد و پاسخ «فعلا مشخص نیست» در مدل تهدید ثبت شد. نصب این اسکیل‌ها جای اسکن را نگرفت: pnpm audit، Gitleaks و probeهای HTTP جدا اجرا شدند.
