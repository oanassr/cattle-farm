-- ============================================================
--  ترقية v2: المنتجات والمخزون ووحدات القياس ولوحة التحكم
--  آمن للتشغيل على قاعدة موجودة (إضافي، لا يحذف بيانات).
--  شغّله في: Supabase > SQL Editor > New query
-- ============================================================

-- ---------- 1) وحدات القياس ----------
create table if not exists public.units (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- 2) الأصناف/المنتجات (قائمة موحّدة) ----------
-- kind: product = منتج يُنتَج ويُباع | packaging = مادة تعبئة تُشترى وتُستهلك | other = بيع بلا مخزون
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  icon         text,
  kind         text not null default 'product' check (kind in ('product','packaging','other')),
  unit         text,
  sale_price   numeric(12,2),
  track_stock  boolean not null default true,
  opening_qty  numeric(12,2) not null default 0,
  opening_date date,
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

-- ---------- 3) الإنتاج (يستبدل تسجيل الحليب ويعمّه لكل المنتجات) ----------
create table if not exists public.production (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid references public.products(id) on delete cascade,
  date          date not null default current_date,
  quantity      numeric(12,2) not null check (quantity >= 0),
  packaging_id  uuid references public.products(id) on delete set null,
  packaging_qty numeric(12,2),
  note          text,
  created_by    uuid references auth.users on delete set null,
  created_at    timestamptz not null default now()
);

-- ---------- 4) ربط المبيعات والمنصرفات بالأصناف ----------
alter table public.revenues add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.expenses add column if not exists product_id uuid references public.products(id) on delete set null;

create index if not exists idx_production_date on public.production(date);
create index if not exists idx_production_product on public.production(product_id);
create index if not exists idx_revenues_product on public.revenues(product_id);
create index if not exists idx_expenses_product on public.expenses(product_id);

-- ---------- 5) دالة حساب المخزون الحالي لكل صنف ----------
create or replace function public.product_stock()
returns table (product_id uuid, current_stock numeric)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
    p.opening_qty
    + coalesce((select sum(quantity)      from production where product_id = p.id), 0)
    + coalesce((select sum(quantity)      from expenses   where product_id = p.id), 0)
    - coalesce((select sum(quantity)      from revenues   where product_id = p.id), 0)
    - coalesce((select sum(packaging_qty) from production where packaging_id = p.id), 0)
  from products p;
$$;

-- ---------- 6) أمان الصفوف ----------
alter table public.units      enable row level security;
alter table public.products   enable row level security;
alter table public.production enable row level security;

-- وحدات القياس: الجميع يقرأ، المالك يعدّل
drop policy if exists "units_read" on public.units;
create policy "units_read" on public.units for select using ( auth.uid() is not null );
drop policy if exists "units_owner_write" on public.units;
create policy "units_owner_write" on public.units for all
  using ( public.user_role() = 'owner' ) with check ( public.user_role() = 'owner' );

-- الأصناف: الجميع يقرأ (للبيع/الإنتاج)، المالك يعدّل (لوحة التحكم)
drop policy if exists "products_read" on public.products;
create policy "products_read" on public.products for select using ( auth.uid() is not null );
drop policy if exists "products_owner_write" on public.products;
create policy "products_owner_write" on public.products for all
  using ( public.user_role() = 'owner' ) with check ( public.user_role() = 'owner' );

-- الإنتاج: المالك/المدير كامل، البائع يقرأ
drop policy if exists "production_manager_all" on public.production;
create policy "production_manager_all" on public.production for all
  using ( public.user_role() in ('owner','manager') )
  with check ( public.user_role() in ('owner','manager') );
drop policy if exists "production_read" on public.production;
create policy "production_read" on public.production for select using ( auth.uid() is not null );

-- ---------- 7) بيانات أولية ----------
insert into public.units (name, sort_order) values
  ('لتر',1),('علبة',2),('كجم',3),('كيس',4),('كرتون',5),('رأس',6),('حبة',7),('صحن',8)
on conflict (name) do nothing;

-- منتجات ألبان (بمخزون)
insert into public.products (name, icon, kind, unit, track_stock, sort_order) values
  ('حليب','🥛','product','لتر', true, 1),
  ('لبن','🥛','product','لتر', true, 2),
  ('زبدة','🧈','product','علبة', true, 3),
  ('سمنة','🫙','product','علبة', true, 4),
  ('جبن','🧀','product','كجم', true, 5),
  ('قشطة','🍶','product','علبة', true, 6)
on conflict (name) do nothing;

-- مبيعات أخرى (بلا مخزون)
insert into public.products (name, icon, kind, unit, track_stock, sort_order) values
  ('بيع الأبقار','🐄','other','رأس', false, 20),
  ('بيع العجول','🐮','other','رأس', false, 21),
  ('بيع السماد','🌱','other','كيس', false, 22),
  ('مبيعات أخرى','➕','other',null, false, 29)
on conflict (name) do nothing;

-- مواد تعبئة (بمخزون، تُشترى كمنصرف)
insert into public.products (name, icon, kind, unit, track_stock, sort_order) values
  ('علبة لتر','🥤','packaging','علبة', true, 40),
  ('علبة نصف لتر','🥤','packaging','علبة', true, 41),
  ('كيس تعبئة','🛍️','packaging','كيس', true, 42)
on conflict (name) do nothing;

-- ---------- 8) ترحيل بيانات الحليب القديمة إلى الإنتاج ----------
insert into public.production (product_id, date, quantity, note, created_by, created_at)
select (select id from public.products where name = 'حليب' limit 1),
       m.date, m.quantity_liters, m.note, m.created_by, m.created_at
from public.milk_production m
where not exists (
  select 1 from public.production p
  where p.date = m.date
    and p.product_id = (select id from public.products where name = 'حليب' limit 1)
    and p.quantity = m.quantity_liters
);

-- ---------- 9) ربط المبيعات القديمة بالأصناف (أفضل جهد بالاسم) ----------
update public.revenues r set product_id = p.id
from public.revenue_categories c, public.products p
where r.category_id = c.id and r.product_id is null
  and (
    (c.name = 'بيع الحليب'        and p.name = 'حليب') or
    (c.name = 'بيع الأبقار'       and p.name = 'بيع الأبقار') or
    (c.name = 'بيع العجول'        and p.name = 'بيع العجول') or
    (c.name = 'بيع السماد'        and p.name = 'بيع السماد') or
    (c.name = 'بيع منتجات ألبان'  and p.name = 'جبن') or
    (c.name = 'أخرى'              and p.name = 'مبيعات أخرى')
  );

-- ---------- 10) رصيد بداية مدة توضيحي لعلب التعبئة ----------
update public.products set opening_qty = 300, opening_date = '2026-06-01' where name = 'علبة لتر'   and opening_qty = 0;
update public.products set opening_qty = 200, opening_date = '2026-06-01' where name = 'علبة نصف لتر' and opening_qty = 0;
