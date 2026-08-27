-- ============================================================
--  ترقية v4: طريقة دفع «شبكة» + التعبئة الافتراضية للمنتج
--  آمن للتشغيل على قاعدة موجودة (إضافي).
--  شغّله في: Supabase > SQL Editor > New query
-- ============================================================

-- 1) طرق الدفع: أضف «شبكة» (card)
alter table public.expenses drop constraint if exists expenses_payment_method_check;
alter table public.expenses add constraint expenses_payment_method_check
  check (payment_method in ('cash','card','bank','credit'));

alter table public.revenues drop constraint if exists revenues_payment_method_check;
alter table public.revenues add constraint revenues_payment_method_check
  check (payment_method in ('cash','card','bank','credit'));

-- 2) التعبئة الافتراضية للمنتج: تُخصم تلقائياً عند تسجيل الإنتاج
alter table public.products add column if not exists packaging_id uuid
  references public.products(id) on delete set null;

-- ربط افتراضي مبدئي (يمكن تعديله من لوحة التحكم لاحقاً)
update public.products set packaging_id = (select id from public.products where name = 'علبة لتر' limit 1)
  where name in ('حليب', 'لبن') and packaging_id is null;
