-- ============================================================
--  ترقية v8: تقييد صلاحيات أمين المخزن
--  • أمين المخزن: صرف (out) من مخزون العلف فقط — لا توريد ولا حذف.
--  • التوريد (in) وصرف الأعلاف على مستوى الإدارة يبقى للمالك/المدير.
--  • كل الحركات تُسجَّل في قاعدة البيانات وتنعكس على كل المستخدمين
--    (القراءة متاحة لكل مستخدم مسجّل، والمخزون يُحتسب من نفس الجدول).
--  شغّله في: Supabase > SQL Editor > New query
-- ============================================================

-- نلغي السياسة العامة القديمة التي كانت تمنح أمين المخزن كامل الصلاحيات
drop policy if exists "stockadj_write" on public.stock_adjustments;

-- 1) المالك/المدير: صلاحيات كاملة على حركات المخزون (توريد + صرف + حذف/تعديل)
drop policy if exists "stockadj_mgr_all" on public.stock_adjustments;
create policy "stockadj_mgr_all" on public.stock_adjustments for all
  using ( public.user_role() in ('owner', 'manager') )
  with check ( public.user_role() in ('owner', 'manager') );

-- 2) أمين المخزن: إضافة حركة «صرف» (out) لأصناف العلف فقط، ومنسوبة له.
--    لا يستطيع التوريد (in) ولا التعديل/الحذف — لحفظ سلامة السجل.
drop policy if exists "stockadj_store_insert" on public.stock_adjustments;
create policy "stockadj_store_insert" on public.stock_adjustments for insert
  with check (
    public.user_role() = 'storekeeper'
    and direction = 'out'
    and created_by = auth.uid()
    and exists (
      select 1 from public.products pr
      where pr.id = product_id and pr.kind = 'feed'
    )
  );

-- 3) القراءة كما هي: كل مستخدم مسجّل يرى الحركات (تنعكس على الجميع)
drop policy if exists "stockadj_read" on public.stock_adjustments;
create policy "stockadj_read" on public.stock_adjustments for select
  using ( auth.uid() is not null );
