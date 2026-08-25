-- ============================================================
--  نظام إدارة مزرعة الأبقار — مخطط قاعدة البيانات (Supabase / Postgres)
--  شغّل هذا الملف كاملاً في: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ---------- الجداول ----------

-- ملفات المستخدمين (مرتبطة بحسابات auth)
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  full_name  text,
  role       text not null default 'seller' check (role in ('owner','manager','seller')),
  created_at timestamptz not null default now()
);

-- فئات المنصرفات
create table if not exists public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  icon       text,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

-- فئات الإيرادات
create table if not exists public.revenue_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  icon       text,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

-- المنصرفات
create table if not exists public.expenses (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid references public.expense_categories(id) on delete set null,
  amount         numeric(12,2) not null check (amount >= 0),
  quantity       numeric(12,2),
  unit           text,
  payment_method text default 'cash' check (payment_method in ('cash','bank','credit')),
  note           text,
  date           date not null default current_date,
  created_by     uuid references auth.users on delete set null,
  created_at     timestamptz not null default now()
);

-- الإيرادات
create table if not exists public.revenues (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid references public.revenue_categories(id) on delete set null,
  amount         numeric(12,2) not null check (amount >= 0),
  quantity       numeric(12,2),
  unit           text,
  payment_method text default 'cash' check (payment_method in ('cash','bank','credit')),
  buyer_name     text,
  note           text,
  date           date not null default current_date,
  created_by     uuid references auth.users on delete set null,
  created_at     timestamptz not null default now()
);

-- إنتاج الحليب اليومي
create table if not exists public.milk_production (
  id              uuid primary key default gen_random_uuid(),
  date            date not null default current_date,
  quantity_liters numeric(12,2) not null check (quantity_liters >= 0),
  session         text not null default 'total' check (session in ('morning','evening','total')),
  note            text,
  created_by      uuid references auth.users on delete set null,
  created_at      timestamptz not null default now(),
  unique (date, session)
);

create index if not exists idx_expenses_date on public.expenses(date);
create index if not exists idx_revenues_date on public.revenues(date);
create index if not exists idx_milk_date     on public.milk_production(date);

-- ---------- دالة معرفة دور المستخدم ----------
create or replace function public.user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------- إنشاء الملف الشخصي تلقائياً عند التسجيل ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'seller')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
--  سياسات الأمان (Row Level Security)
-- ============================================================
alter table public.profiles           enable row level security;
alter table public.expense_categories enable row level security;
alter table public.revenue_categories enable row level security;
alter table public.expenses           enable row level security;
alter table public.revenues           enable row level security;
alter table public.milk_production     enable row level security;

-- ---- profiles ----
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using ( id = auth.uid() or public.user_role() = 'owner' );

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update
  using ( id = auth.uid() ) with check ( id = auth.uid() );

drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all" on public.profiles for all
  using ( public.user_role() = 'owner' ) with check ( public.user_role() = 'owner' );

-- ---- فئات المنصرفات: الجميع يقرأ، المالك/المدير يعدّل ----
drop policy if exists "exp_cat_read" on public.expense_categories;
create policy "exp_cat_read" on public.expense_categories for select
  using ( auth.uid() is not null );
drop policy if exists "exp_cat_write" on public.expense_categories;
create policy "exp_cat_write" on public.expense_categories for all
  using ( public.user_role() in ('owner','manager') )
  with check ( public.user_role() in ('owner','manager') );

-- ---- فئات الإيرادات ----
drop policy if exists "rev_cat_read" on public.revenue_categories;
create policy "rev_cat_read" on public.revenue_categories for select
  using ( auth.uid() is not null );
drop policy if exists "rev_cat_write" on public.revenue_categories;
create policy "rev_cat_write" on public.revenue_categories for all
  using ( public.user_role() in ('owner','manager') )
  with check ( public.user_role() in ('owner','manager') );

-- ---- المنصرفات: المالك/المدير فقط ----
drop policy if exists "expenses_rw" on public.expenses;
create policy "expenses_rw" on public.expenses for all
  using ( public.user_role() in ('owner','manager') )
  with check ( public.user_role() in ('owner','manager') );

-- ---- الإيرادات: المالك/المدير كامل، البائع يضيف ويقرأ مبيعاته ----
drop policy if exists "revenues_manager_all" on public.revenues;
create policy "revenues_manager_all" on public.revenues for all
  using ( public.user_role() in ('owner','manager') )
  with check ( public.user_role() in ('owner','manager') );

drop policy if exists "revenues_seller_select_own" on public.revenues;
create policy "revenues_seller_select_own" on public.revenues for select
  using ( public.user_role() = 'seller' and created_by = auth.uid() );

drop policy if exists "revenues_seller_insert" on public.revenues;
create policy "revenues_seller_insert" on public.revenues for insert
  with check ( public.user_role() = 'seller' and created_by = auth.uid() );

-- ---- إنتاج الحليب: المالك/المدير كامل، البائع يقرأ ----
drop policy if exists "milk_manager_all" on public.milk_production;
create policy "milk_manager_all" on public.milk_production for all
  using ( public.user_role() in ('owner','manager') )
  with check ( public.user_role() in ('owner','manager') );

drop policy if exists "milk_seller_read" on public.milk_production;
create policy "milk_seller_read" on public.milk_production for select
  using ( auth.uid() is not null );

-- ============================================================
--  بيانات الفئات الافتراضية (تُدرج مرة واحدة)
-- ============================================================
insert into public.expense_categories (name, icon, sort_order) values
  ('أعلاف',                '🌾', 1),
  ('أدوية وعلاج بيطري',    '💉', 2),
  ('عمالة ورواتب',         '👷', 3),
  ('كهرباء وماء',          '💡', 4),
  ('صيانة ومعدات',         '🔧', 5),
  ('شراء أبقار',           '🐄', 6),
  ('نقل ومواصلات',         '🚚', 7),
  ('مستلزمات عامة',        '📦', 8),
  ('أخرى',                 '➕', 99)
on conflict do nothing;

insert into public.revenue_categories (name, icon, sort_order) values
  ('بيع الحليب',           '🥛', 1),
  ('بيع الأبقار',          '🐄', 2),
  ('بيع العجول',           '🐮', 3),
  ('بيع السماد',           '🌱', 4),
  ('بيع منتجات ألبان',     '🧀', 5),
  ('أخرى',                 '➕', 99)
on conflict do nothing;

-- ============================================================
--  بعد تسجيل أول مستخدم، اجعله مالكاً بتنفيذ:
--  update public.profiles set role = 'owner'
--  where id = (select id from auth.users order by created_at limit 1);
-- ============================================================
