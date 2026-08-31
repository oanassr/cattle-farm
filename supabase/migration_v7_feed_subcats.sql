-- ============================================================
--  ترقية v7: فئات فرعية للمنصرفات + مخزن الأعلاف (أمين مخزن،
--  صرف/إضافة، نقطة إعادة طلب) + حركات مخزون
--  شغّله في: Supabase > SQL Editor > New query
-- ============================================================

-- 1) فئات فرعية للمنصرفات (parent_id ذاتي المرجع)
alter table public.expense_categories add column if not exists parent_id uuid
  references public.expense_categories(id) on delete cascade;

-- 2) نقطة إعادة الطلب لكل صنف (تنبيه عند بلوغها)
alter table public.products add column if not exists reorder_point numeric(12,2) not null default 0;

-- 3) دور «أمين المخزن»
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner', 'manager', 'seller', 'storekeeper'));

-- 4) حركات المخزون: صرف (out) وإضافة (in) — للأعلاف وغيرها
create table if not exists public.stock_adjustments (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  qty        numeric(12,2) not null check (qty >= 0),
  direction  text not null check (direction in ('in', 'out')),
  reason     text,
  date       date not null default current_date,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_stockadj_product on public.stock_adjustments(product_id);

-- 5) تحديث دالة المخزون لتشمل حركات المخزون
create or replace function public.product_stock()
returns table (product_id uuid, current_stock numeric)
language sql stable security definer set search_path = public as $$
  select p.id,
    p.opening_qty
    + coalesce((select sum(quantity) from production where product_id = p.id), 0)
    + coalesce((select sum(quantity) from expenses   where product_id = p.id), 0)
    + coalesce((select sum(qty)      from stock_adjustments where product_id = p.id and direction = 'in'), 0)
    - coalesce((select sum(quantity)      from revenues   where product_id = p.id), 0)
    - coalesce((select sum(packaging_qty) from production where packaging_id = p.id), 0)
    - coalesce((select sum(qty)           from stock_adjustments where product_id = p.id and direction = 'out'), 0)
  from products p;
$$;

-- 6) أمان حركات المخزون
alter table public.stock_adjustments enable row level security;
drop policy if exists "stockadj_read" on public.stock_adjustments;
create policy "stockadj_read" on public.stock_adjustments for select using ( auth.uid() is not null );
drop policy if exists "stockadj_write" on public.stock_adjustments;
create policy "stockadj_write" on public.stock_adjustments for all
  using ( public.user_role() in ('owner', 'manager', 'storekeeper') )
  with check ( public.user_role() in ('owner', 'manager', 'storekeeper') );

-- أمين المخزن يحتاج قراءة/كتابة الإنتاج؟ لا. لكن يقرأ الأصناف (كل مسجّل يقرأ).
-- اسمح لأمين المخزن بقراءة المنصرفات (لمشتريات الأعلاف) — اختياري:
drop policy if exists "expenses_storekeeper_read" on public.expenses;
create policy "expenses_storekeeper_read" on public.expenses for select
  using ( public.user_role() = 'storekeeper' );

-- 7) بيانات: فئات فرعية افتراضية + نقاط إعادة طلب للأعلاف
do $$
declare mid uuid;
begin
  -- أعلاف
  select id into mid from public.expense_categories where name = 'أعلاف' and parent_id is null limit 1;
  if mid is not null then
    insert into public.expense_categories (name, icon, parent_id, sort_order) values
      ('علف مركّز', '🌾', mid, 1), ('برسيم / تبن', '🌿', mid, 2),
      ('شعير', '🌾', mid, 3), ('نخالة', '🥣', mid, 4)
    on conflict do nothing;
  end if;
  -- أدوية وعلاج بيطري
  select id into mid from public.expense_categories where name = 'أدوية وعلاج بيطري' and parent_id is null limit 1;
  if mid is not null then
    insert into public.expense_categories (name, icon, parent_id, sort_order) values
      ('تطعيمات', '💉', mid, 1), ('مضادات حيوية', '💊', mid, 2), ('فيتامينات', '🧪', mid, 3)
    on conflict do nothing;
  end if;
  -- كهرباء وماء
  select id into mid from public.expense_categories where name = 'كهرباء وماء' and parent_id is null limit 1;
  if mid is not null then
    insert into public.expense_categories (name, icon, parent_id, sort_order) values
      ('كهرباء', '💡', mid, 1), ('ماء', '💧', mid, 2)
    on conflict do nothing;
  end if;
end $$;

-- نقاط إعادة الطلب للأعلاف
update public.products set reorder_point = 3 where kind = 'feed' and reorder_point = 0;
