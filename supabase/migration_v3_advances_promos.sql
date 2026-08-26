-- ============================================================
--  ترقية v3: السلفيات (حساب المدير) + العروض السعرية المؤقتة
--  آمن للتشغيل على قاعدة موجودة (إضافي).
--  شغّله في: Supabase > SQL Editor > New query
-- ============================================================

-- ---------- 1) السلفيات: حساب جاري بين المالك والمدير ----------
-- type: advance = سلفة يمنحها المالك للمدير | settlement = تسوية/إرجاع من المدير
create table if not exists public.advances (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references auth.users on delete cascade,
  amount     numeric(12,2) not null check (amount >= 0),
  type       text not null check (type in ('advance','settlement')),
  date       date not null default current_date,
  note       text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_advances_person on public.advances(person_id);
create index if not exists idx_advances_date on public.advances(date);

-- ربط المصروف بأنه مدفوع من سلفة المدير (يُخصم من رصيد سلفته)
alter table public.expenses add column if not exists from_advance boolean not null default false;

-- ---------- 2) العروض: سعر ترويجي للمنتج خلال فترة ----------
create table if not exists public.promotions (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  promo_price numeric(12,2) not null check (promo_price >= 0),
  start_date date not null,
  end_date   date not null,
  is_active  boolean not null default true,
  note       text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_promotions_product on public.promotions(product_id);
create index if not exists idx_promotions_dates on public.promotions(start_date, end_date);

-- ---------- 3) دالة أرصدة السلف (لكل شخص: ممنوح − مُسوّى − مصروف من السلفة) ----------
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
    coalesce((select sum(amount) from expenses where from_advance and created_by = pr.id), 0),
    coalesce((select sum(amount) from advances where person_id = pr.id and type = 'advance'), 0)
      - coalesce((select sum(amount) from advances where person_id = pr.id and type = 'settlement'), 0)
      - coalesce((select sum(amount) from expenses where from_advance and created_by = pr.id), 0)
  from profiles pr
  where public.user_role() = 'owner' or pr.id = auth.uid();
$$;

-- ---------- 4) دالة السعر الفعّال لمنتج بتاريخ (يراعي العروض) ----------
create or replace function public.effective_price(p_product uuid, p_date date)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select promo_price from promotions
      where product_id = p_product and is_active
        and p_date between start_date and end_date
      order by start_date desc limit 1),
    (select sale_price from products where id = p_product)
  );
$$;

-- ---------- 5) أمان الصفوف ----------
alter table public.advances   enable row level security;
alter table public.promotions enable row level security;

-- السلفيات: المالك كامل، والشخص يقرأ سجلّه فقط
drop policy if exists "advances_owner_all" on public.advances;
create policy "advances_owner_all" on public.advances for all
  using ( public.user_role() = 'owner' ) with check ( public.user_role() = 'owner' );
drop policy if exists "advances_read_own" on public.advances;
create policy "advances_read_own" on public.advances for select
  using ( person_id = auth.uid() );

-- العروض: الجميع يقرأ (لتطبيق السعر في البيع)، المالك يعدّل
drop policy if exists "promotions_read" on public.promotions;
create policy "promotions_read" on public.promotions for select using ( auth.uid() is not null );
drop policy if exists "promotions_owner_write" on public.promotions;
create policy "promotions_owner_write" on public.promotions for all
  using ( public.user_role() = 'owner' ) with check ( public.user_role() = 'owner' );
