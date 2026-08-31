-- ============================================================
--  ترقية v8: أمين المخزن يصرف فقط (لا يورّد)
--  المالك/المدير: توريد + صرف. أمين المخزن: صرف (out) فقط.
--  شغّله في: Supabase > SQL Editor > New query
-- ============================================================

drop policy if exists "stockadj_write" on public.stock_adjustments;
drop policy if exists "stockadj_mgr" on public.stock_adjustments;
drop policy if exists "stockadj_store_insert" on public.stock_adjustments;
drop policy if exists "stockadj_store_delete" on public.stock_adjustments;

-- المالك والمدير: صلاحية كاملة (توريد + صرف)
create policy "stockadj_mgr" on public.stock_adjustments for all
  using ( public.user_role() in ('owner', 'manager') )
  with check ( public.user_role() in ('owner', 'manager') );

-- أمين المخزن: صرف فقط (إدراج حركات direction='out')
create policy "stockadj_store_insert" on public.stock_adjustments for insert
  with check ( public.user_role() = 'storekeeper' and direction = 'out' );

-- أمين المخزن: حذف حركاته هو فقط
create policy "stockadj_store_delete" on public.stock_adjustments for delete
  using ( public.user_role() = 'storekeeper' and created_by = auth.uid() );

-- (سياسة القراءة stockadj_read لكل مسجّل تبقى كما هي)
