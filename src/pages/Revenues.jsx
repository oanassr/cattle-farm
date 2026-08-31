import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PageHead, StatCard, EmptyState, Modal, Loader } from '../components/ui'
import DateField from '../components/DateField'
import { fmtRiyal, fmtDate, fmtNum, todayISO, monthRange, PAYMENT_METHODS } from '../lib/format'
import { loadProducts, loadStockMap } from '../lib/catalog'

const emptyForm = {
  product_id: '', amount: '', quantity: '',
  payment_method: 'cash', buyer_name: '', note: '', date: todayISO(),
}

export default function Revenues() {
  const { user, role } = useAuth()
  const isSeller = role === 'seller'
  const [products, setProducts] = useState([])
  const [stock, setStock] = useState({})
  const [promos, setPromos] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { start, end } = monthRange(month)
    const [p, s, { data: pr }, { data: r }] = await Promise.all([
      loadProducts(), loadStockMap(),
      supabase.from('promotions').select('*').eq('is_active', true),
      supabase.from('revenues')
        .select('*, products:product_id(name, icon, unit, track_stock), revenue_categories(name, icon)')
        .gte('date', start).lt('date', end)
        .order('date', { ascending: false }),
    ])
    setProducts(p); setStock(s); setPromos(pr || []); setRows(r || []); setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const sellables = products.filter((p) => p.is_active && p.kind !== 'packaging')
  const selected = products.find((p) => p.id === form.product_id)

  // السعر الفعّال للوحدة (يراعي العروض حسب التاريخ)
  const unitPrice = (pid, date) => {
    const promo = promos.find((x) => x.product_id === pid && date >= x.start_date && date <= x.end_date)
    if (promo) return { price: Number(promo.promo_price), promo: true }
    const p = products.find((x) => x.id === pid)
    return { price: p?.sale_price != null ? Number(p.sale_price) : null, promo: false }
  }
  const priceInfo = form.product_id ? unitPrice(form.product_id, form.date) : { price: null, promo: false }

  const openAdd = () => { setForm({ ...emptyForm }); setEditId(null); setModal(true) }
  const openEdit = (r) => {
    setForm({
      product_id: r.product_id || '', amount: r.amount, quantity: r.quantity ?? '',
      payment_method: r.payment_method || 'cash',
      buyer_name: r.buyer_name || '', note: r.note || '', date: r.date,
    })
    setEditId(r.id); setModal(true)
  }

  // حساب المبلغ من السعر الفعّال (العرض أو العادي)
  const calcAmount = (pid, date, qty) => {
    const { price } = unitPrice(pid, date)
    return price != null && qty !== '' && qty != null ? String(price * Number(qty)) : null
  }
  const onPickProduct = (id) => setForm((f) => ({ ...f, product_id: id, amount: calcAmount(id, f.date, f.quantity) ?? f.amount }))
  const onQty = (v) => setForm((f) => ({ ...f, quantity: v, amount: calcAmount(f.product_id, f.date, v) ?? f.amount }))
  const onDate = (v) => setForm((f) => ({ ...f, date: v, amount: calcAmount(f.product_id, v, f.quantity) ?? f.amount }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      product_id: form.product_id || null,
      category_id: null,
      amount: Number(form.amount),
      quantity: form.quantity === '' ? null : Number(form.quantity),
      unit: selected?.unit || null,
      payment_method: form.payment_method,
      buyer_name: form.buyer_name || null,
      note: form.note || null,
      date: form.date,
    }
    let error
    if (editId) {
      ({ error } = await supabase.from('revenues').update(payload).eq('id', editId))
    } else {
      ({ error } = await supabase.from('revenues').insert({ ...payload, created_by: user.id }))
    }
    setSaving(false)
    if (error) { alert('حدث خطأ أثناء الحفظ: ' + error.message); return }
    setModal(false); load()
  }

  const remove = async (id) => {
    if (!confirm('هل تريد حذف هذا الإيراد؟')) return
    const { error } = await supabase.from('revenues').delete().eq('id', id)
    if (error) { alert('تعذّر الحذف: ' + error.message); return }
    load()
  }

  const total = rows.reduce((s, r) => s + Number(r.amount), 0)
  const avail = selected?.track_stock ? (stock[selected.id] ?? 0) : null
  const overStock = avail != null && form.quantity !== '' && Number(form.quantity) > avail

  return (
    <div>
      <PageHead
        title="💰 الإيرادات"
        subtitle={isSeller ? 'سجّل مبيعاتك واطّلع عليها' : 'مبيعات وإيرادات المزرعة'}>
        <button className="btn btn-primary" onClick={openAdd}>＋ تسجيل مبيع</button>
      </PageHead>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 18 }}>
        <StatCard icon="💰" label={isSeller ? 'إجمالي مبيعاتي هذا الشهر' : 'إجمالي إيرادات الشهر'} value={total} tone="green" sub={`${rows.length} عملية`} />
        <div className="card card-pad">
          <label style={{ fontWeight: 700, fontSize: 14 }}>عرض شهر</label>
          <input className="input" type="month" value={month} dir="ltr"
            onChange={(e) => setMonth(e.target.value)} style={{ marginTop: 8 }} />
        </div>
      </div>

      <div className="card">
        {loading ? <Loader /> : rows.length === 0 ? (
          <EmptyState icon="💰" title="لا توجد إيرادات هذا الشهر" hint="اضغط «تسجيل مبيع» للبدء" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>التاريخ</th><th>الصنف</th><th>المبلغ</th>
                  <th>الكمية</th><th>المشتري</th><th>الدفع</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const item = r.products || r.revenue_categories
                  return (
                    <tr key={r.id}>
                      <td className="mono">{fmtDate(r.date)}</td>
                      <td>
                        <span className="badge badge-green">
                          {item?.icon} {item?.name || 'غير مصنّف'}
                        </span>
                      </td>
                      <td className="mono text-green" style={{ fontWeight: 700 }}>{fmtRiyal(r.amount)}</td>
                      <td className="mono muted">{r.quantity ? `${fmtNum(r.quantity)} ${r.products?.unit || r.unit || ''}` : '—'}</td>
                      <td className="muted">{r.buyer_name || '—'}</td>
                      <td className="muted">{PAYMENT_METHODS[r.payment_method]}</td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>تعديل</button>
                          <button className="btn btn-danger btn-sm" onClick={() => remove(r.id)}>حذف</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal title={editId ? 'تعديل إيراد' : 'تسجيل مبيع'} onClose={() => setModal(false)}>
          <form onSubmit={save}>
            <div className="field">
              <label>الصنف</label>
              <select className="select" required value={form.product_id}
                onChange={(e) => onPickProduct(e.target.value)}>
                <option value="">— اختر الصنف —</option>
                {sellables.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.name}{p.track_stock ? ` — متاح ${fmtNum(stock[p.id] ?? 0)} ${p.unit || ''}` : ''}
                  </option>
                ))}
              </select>
              {priceInfo.price != null && (
                <div style={{ fontSize: 12.5, marginTop: 6 }}>
                  {priceInfo.promo ? (
                    <span style={{ color: 'var(--green-700)', fontWeight: 700 }}>
                      🎉 عرض ساري: {fmtRiyal(priceInfo.price)} / {selected?.unit || 'وحدة'}
                      {selected?.sale_price != null && <span className="muted" style={{ fontWeight: 400 }}> (بدل {fmtRiyal(selected.sale_price)})</span>}
                    </span>
                  ) : (
                    <span className="muted">💡 السعر: {fmtRiyal(priceInfo.price)} / {selected?.unit || 'وحدة'}</span>
                  )}
                </div>
              )}
            </div>
            <div className="row row-wrap" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 120 }}>
                <label>الكمية {selected?.unit ? `(${selected.unit})` : ''}</label>
                <input className="input" type="number" min="0" step="0.01" dir="ltr"
                  value={form.quantity} onChange={(e) => onQty(e.target.value)} />
                {overStock && (
                  <div style={{ color: 'var(--red-600)', fontSize: 12.5, marginTop: 6, fontWeight: 600 }}>
                    ⚠️ الكمية تتجاوز المتاح ({fmtNum(avail)} {selected.unit})
                  </div>
                )}
              </div>
              <div className="field" style={{ flex: 1, minWidth: 120 }}>
                <label>المبلغ الإجمالي (﷼)</label>
                <input className="input" type="number" min="0" step="0.01" required dir="ltr"
                  value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <DateField value={form.date} onChange={onDate} />
            </div>
            <div className="row row-wrap" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label>طريقة الدفع</label>
                <select className="select" value={form.payment_method}
                  onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                  {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label>اسم المشتري (اختياري)</label>
                <input className="input" value={form.buyer_name}
                  onChange={(e) => setForm({ ...form, buyer_name: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>ملاحظة (اختياري)</label>
              <textarea className="input" value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <button className="btn btn-primary btn-block" disabled={saving}>
              {saving ? <span className="spinner" /> : (editId ? 'حفظ التعديل' : 'تسجيل المبيع')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
