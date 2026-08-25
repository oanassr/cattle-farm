import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PageHead, StatCard, EmptyState, Modal, Loader } from '../components/ui'
import { fmtRiyal, fmtDate, fmtNum, todayISO, PAYMENT_METHODS } from '../lib/format'

const emptyForm = {
  category_id: '', amount: '', quantity: '', unit: '',
  payment_method: 'cash', note: '', date: todayISO(),
}

export default function Expenses() {
  const { user } = useAuth()
  const [cats, setCats] = useState([])
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
    const [{ data: c }, { data: e }] = await Promise.all([
      supabase.from('expense_categories').select('*').order('sort_order'),
      supabase.from('expenses')
        .select('*, expense_categories(name, icon)')
        .gte('date', start).lt('date', end)
        .order('date', { ascending: false }),
    ])
    setCats(c || [])
    setRows(e || [])
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const openAdd = () => { setForm({ ...emptyForm }); setEditId(null); setModal(true) }
  const openEdit = (r) => {
    setForm({
      category_id: r.category_id || '', amount: r.amount, quantity: r.quantity ?? '',
      unit: r.unit || '', payment_method: r.payment_method || 'cash',
      note: r.note || '', date: r.date,
    })
    setEditId(r.id); setModal(true)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      category_id: form.category_id || null,
      amount: Number(form.amount),
      quantity: form.quantity === '' ? null : Number(form.quantity),
      unit: form.unit || null,
      payment_method: form.payment_method,
      note: form.note || null,
      date: form.date,
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
                  <th>الكمية</th><th>الدفع</th><th>ملاحظة</th><th></th>
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
                    <td className="muted">{PAYMENT_METHODS[r.payment_method]}</td>
                    <td className="muted" style={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.note || '—'}</td>
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
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label>التاريخ</label>
                <input className="input" type="date" required dir="ltr"
                  value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="row row-wrap" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 120 }}>
                <label>الكمية (اختياري)</label>
                <input className="input" type="number" min="0" step="0.01" dir="ltr"
                  value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 120 }}>
                <label>الوحدة</label>
                <input className="input" placeholder="كيس / كجم / لتر"
                  value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 120 }}>
                <label>طريقة الدفع</label>
                <select className="select" value={form.payment_method}
                  onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                  {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
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
