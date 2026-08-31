-- ============================================================
--  ترقية v9: رصيد بداية المدة لكل صنف لكل فترة (ترحيل عند الإقفال)
--  رصيد البداية يُدخَل مرة واحدة (opening_qty)، وعند إقفال الشهر
--  يُلتقط مخزون الإقفال ويُخزّن كرصيد افتتاحي للشهر التالي.
--  شغّله في: Supabase > SQL Editor > New query
-- ============================================================

create table if not exists public.period_stock (
  id          uuid primary key default gen_random_uuid(),
  month       text not null,                 -- 'YYYY-MM'
  product_id  uuid references public.products(id) on delete cascade,
  opening_qty numeric(12,2) not null default 0,
  created_at  timestamptz not null default now(),
  unique (month, product_id)
);
create index if not exists idx_period_stock_month on public.period_stock(month);

alter table public.period_stock enable row level security;
drop policy if exists "period_stock_read" on public.period_stock;
create policy "period_stock_read" on public.period_stock for select using ( auth.uid() is not null );
drop policy if exists "period_stock_owner" on public.period_stock;
create policy "period_stock_owner" on public.period_stock for all
  using ( public.user_role() = 'owner' ) with check ( public.user_role() = 'owner' );
