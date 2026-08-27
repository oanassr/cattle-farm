-- ============================================================
--  ترقية v5: نموذج «العهدة» للسلفيات
--  المصروف المُعلَّم «من السلفة» يصبح تلقائياً سلفة على الشخص،
--  دون حاجة لتسجيل منح سلفة منفصل. الرصيد يُسوّى شهرياً.
--  شغّله في: Supabase > SQL Editor > New query
-- ============================================================

-- نسبة مصروف السلفة إلى شخص (قد يسجّله المالك نيابةً عن المدير)
alter table public.expenses add column if not exists advance_person_id uuid
  references auth.users on delete set null;

-- ترحيل: المصروفات القديمة «من السلفة» تُنسب لمن سجّلها
update public.expenses set advance_person_id = created_by
  where from_advance and advance_person_id is null;

-- تنظيف بيانات تجريبية قديمة (منح سلفة يدوي لم يعد أساس النموذج)
delete from public.advances where type = 'advance' and note = 'سلفة تشغيل الشهر';

-- إعادة تعريف دالة الأرصدة:
--  الرصيد = (منح نقدي مباشر) + (منصرفات من السلفة) − (تسويات)
create or replace function public.advance_balances()
returns table (person_id uuid, total_advance numeric, total_settle numeric, total_spent numeric, balance numeric)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id,
    coalesce((select sum(amount) from advances where person_id = pr.id and type = 'advance'), 0),
    coalesce((select sum(amount) from advances where person_id = pr.id and type = 'settlement'), 0),
    coalesce((select sum(amount) from expenses where from_advance and advance_person_id = pr.id), 0),
    coalesce((select sum(amount) from advances where person_id = pr.id and type = 'advance'), 0)
      + coalesce((select sum(amount) from expenses where from_advance and advance_person_id = pr.id), 0)
      - coalesce((select sum(amount) from advances where person_id = pr.id and type = 'settlement'), 0)
  from profiles pr
  where public.user_role() = 'owner' or pr.id = auth.uid();
$$;
