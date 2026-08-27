import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PageHead, StatCard, EmptyState, Modal, Loader } from '../components/ui'
import DateField from '../components/DateField'
import { fmtRiyal, fmtDate, fmtNum, todayISO, PAYMENT_METHODS } from '../lib/format'
import { loadProducts, loadUnits } from '../lib/catalog'

const emptyForm = {
  category_id: '', product_id: '', amount: '', quantity: '', unit: '',
  payment_method: 'cash', note: '', date: todayISO(), from_advance: false, advance_person_id: '',
}

export default function Expenses() {
  const { user, role } = useAuth()
  const isOwner = role === 'owner'
  const [cats, setCats] = useState([])
  const [units, setUnits] = useState([])
  const [staff, setStaff] = useState([])
  const [packagings, setPackagings] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const start = `${month}-01`
    const end = new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 1)
      .toISOString().slice(0, 10)
    const [{ data: c }, u, prods, { data: profs }, { data: e }] = await Promise.all([
      supabase.from('expense_categories').select('*').order('sort_order'),
      loadUnits(), loadProducts(),
      supabase.from('profiles').select('id, full_name, role'),
      supabase.from('expenses')
        .select('*, expense_categories(name, icon), products:product_id(name, icon)')
        .gte('date', start).lt('date', end)
        .order('date', { ascending: false }),
    ])
    setCats(c || [])
    setUnits(u)
    setStaff((profs || []).filter((p) => p.role !== 'owner'))
    setPackagings(prods.filter((p) => p.kind === 'packaging' && p.is_active))
    setRows(e || [])
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const openAdd = () => { setForm({ ...emptyForm }); setEditId(null); setModal(true) }
  const openEdit = (r) => {
    setForm({
      category_id: r.category_id || '', product_id: r.product_id || '', amount: r.amount,
      quantity: r.quantity ?? '', unit: r.unit || '', payment_method: r.payment_method || 'cash',
      note: r.note || '', date: r.date, from_advance: !!r.from_advance,
      advance_person_id: r.advance_person_id || '',
    })
    setEditId(r.id); setModal(true)
  }

  // اختيار صنف تعبئة: يضبط الوحدة تلقائياً
  const onPickPackaging = (id) => {
    const p = packagings.find((x) => x.id === id)
    setForm((f) => ({ ...f, product_id: id, unit: p?.unit || f.unit }))
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      category_id: form.category_id || null,
      product_id: form.product_id || null,
      amount: Number(form.amount),
      quantity: form.quantity === '' ? null : Number(form.quantity),
      unit: form.unit || null,
      payment_method: form.payment_method,
      note: form.note || null,
      date: form.date,
      from_advance: form.from_advance,
      advance_person_id: form.from_advance ? (form.advance_person_id || user.id) : null,
    }
    let error
    if (editId) {
      ({ error } = await supabase.from('expenses').update(payload).eq('id', editId))
    } else {
      ({ error } = await supabase.from('expenses').insert({ ...payload, created_by: user.id }))
    }
    setSaving(false)
    if (error) { alert('حدث خطأ أثناء الحفظ: ' + error.message); return }
    setModal(false); load()
  }

  const remove = async (id) => {
    if (!confirm('هل تريد حذف هذا المصروف؟')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { alert('تعذّر الحذف: ' + error.message); return }
    load()
  }

  const total = rows.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div>
      <PageHead title="🧾 المنصرفات" subtitle="تسجيل مصروفات المزرعة بفئات جاهزة">
        <button className="btn btn-primary" onClick={openAdd}>＋ إضافة مصروف</button>
      </PageHead>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 18 }}>
        <StatCard icon="🧾" label="إجمالي منصرفات الشهر" value={total} tone="red" sub={`${rows.length} عملية`} />
        <div className="card card-pad">
          <label style={{ fontWeight: 700, fontSize: 14 }}>عرض شهر</label>
          <input className="input" type="month" value={month} dir="ltr"
            onChange={(e) => setMonth(e.target.value)} style={{ marginTop: 8 }} />
        </div>
      </div>

      <div className="card">
        {loading ? <Loader /> : rows.length === 0 ? (
          <EmptyState icon="🧾" title="لا توجد منصرفات هذا الشهر" hint="اضغط «إضافة مصروف» للبدء" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>التاريخ</th><th>الفئة</th><th>المبلغ</th>
                  <th>الكمية</th><th>مخزون</th><th>الدفع</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{fmtDate(r.date)}</td>
                    <td>
                      <span className="badge badge-amber">
                        {r.expense_categories?.icon} {r.expense_categories?.name || 'غير مصنّف'}
                      </span>
                    </td>
                    <td className="mono text-red" style={{ fontWeight: 700 }}>{fmtRiyal(r.amount)}</td>
                    <td className="mono muted">{r.quantity ? `${fmtNum(r.quantity)} ${r.unit || ''}` : '—'}</td>
                    <td className="muted">{r.products ? <span className="badge badge-blue">{r.products.icon} {r.products.name}</span> : '—'}</td>
                    <td className="muted">
                      {PAYMENT_METHODS[r.payment_method]}
                      {r.from_advance && <span className="badge badge-amber" style={{ marginRight: 6 }}>💵 سلفة</span>}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>تعديل</button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(r.id)}>حذف</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal title={editId ? 'تعديل مصروف' : 'إضافة مصروف'} onClose={() => setModal(false)}>
          <form onSubmit={save}>
            <div className="field">
              <label>الفئة</label>
              <select className="select" required value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">— اختر الفئة —</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div className="row row-wrap" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label>المبلغ (﷼)</label>
                <input className="input" type="number" min="0" step="0.01" required dir="ltr"
                  value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <DateField value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            </div>
            <div className="row row-wrap" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 120 }}>
                <label>الكمية (اختياري)</label>
                <input className="input" type="number" min="0" step="0.01" dir="ltr"
                  value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 120 }}>
                <label>الوحدة</label>
                <select className="select" value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  <option value="">— بلا وحدة —</option>
                  {units.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: 1, minWidth: 120 }}>
                <label>طريقة الدفع</label>
                <select className="select" value={form.payment_method}
                  onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                  {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            {packagings.length > 0 && (
              <div className="card card-pad" style={{ background: 'var(--green-50)', marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'block' }}>
                  📦 شراء مخزون تعبئة (اختياري) — يُضاف للكمية أعلاه إلى المخزون
                </label>
                <select className="select" value={form.product_id}
                  onChange={(e) => onPickPackaging(e.target.value)}>
                  <option value="">— ليس شراء مخزون —</option>
                  {packagings.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.name} ({p.unit || ''})</option>)}
                </select>
                {form.product_id && (
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
                    ℹ️ سيُضاف <b>{form.quantity || 0} {form.unit}</b> إلى مخزون هذا الصنف.
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: 14, padding: 12, background: 'var(--earth-100)', borderRadius: 'var(--radius-sm)' }}>
              <label className="row center" style={{ gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.from_advance}
                  onChange={(e) => setForm({ ...form, from_advance: e.target.checked })} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>💵 مدفوع من السلفة (عهدة) — يُسجَّل كسلفة على الشخص</span>
              </label>
              {form.from_advance && isOwner && (
                <div className="field" style={{ margin: '10px 0 0' }}>
                  <label>على سلفة مَن؟</label>
                  <select className="select" required value={form.advance_person_id}
                    onChange={(e) => setForm({ ...form, advance_person_id: e.target.value })}>
                    <option value="">— اختر الشخص —</option>
                    {staff.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              )}
              {form.from_advance && !isOwner && (
                <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>سيُسجَّل على سلفتك (عهدتك) تلقائياً.</div>
              )}
            </div>
            <div className="field">
              <label>ملاحظة (اختياري)</label>
              <textarea className="input" value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <button className="btn btn-primary btn-block" disabled={saving}>
              {saving ? <span className="spinner" /> : (editId ? 'حفظ التعديل' : 'إضافة المصروف')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
