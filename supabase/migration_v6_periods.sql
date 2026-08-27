-- ============================================================
--  ترقية v6: الفترات والإقفال الشهري + أصناف الأعلاف
--  آمن للتشغيل على قاعدة موجودة (إضافي).
--  شغّله في: Supabase > SQL Editor > New query
-- ============================================================

-- 1) الفترات (شهر): رصيد نقدي افتتاحي + حالة الإقفال
create table if not exists public.periods (
  id           uuid primary key default gen_random_uuid(),
  month        text not null unique,            -- 'YYYY-MM'
  opening_cash numeric(12,2) not null default 0,
  status       text not null default 'open' check (status in ('open', 'closed')),
  note         text,
  closed_at    timestamptz,
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now()
);

alter table public.periods enable row level security;
drop policy if exists "periods_owner_all" on public.periods;
create policy "periods_owner_all" on public.periods for all
  using ( public.user_role() = 'owner' ) with check ( public.user_role() = 'owner' );
drop policy if exists "periods_read" on public.periods;
create policy "periods_read" on public.periods for select using ( auth.uid() is not null );

-- 2) أضف نوع «علف» للأصناف (لتتبّع مخزون الأعلاف)
alter table public.products drop constraint if exists products_kind_check;
alter table public.products add constraint products_kind_check
  check (kind in ('product', 'packaging', 'feed', 'other'));

-- أصناف أعلاف افتراضية
insert into public.products (name, icon, kind, unit, track_stock, sort_order) values
  ('علف مركّز', '🌾', 'feed', 'كيس', true, 50),
  ('برسيم / تبن', '🌿', 'feed', 'طن', true, 51)
on conflict (name) do nothing;
