import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PageHead, StatCard, EmptyState, Modal, Loader } from '../components/ui'
import DateField from '../components/DateField'
import { fmtNum, fmtDate, todayISO } from '../lib/format'
import { loadProducts, loadStockMap } from '../lib/catalog'

const empty = { product_id: '', direction: 'out', qty: '', date: todayISO(), reason: '' }

export default function Warehouse() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const start = `${month}-01`
    const end = new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 1).toISOString().slice(0, 10)
    const [prods, stockMap, { data: adj }] = await Promise.all([
      loadProducts(), loadStockMap(),
      supabase.from('stock_adjustments')
        .select('*, products:product_id(name, icon, unit)')
        .gte('date', start).lt('date', end).order('date', { ascending: false }),
    ])
    setItems((prods || [])
      .filter((p) => (p.kind === 'feed' || p.kind === 'packaging') && p.track_stock)
      .map((p) => ({ ...p, stock: stockMap[p.id] ?? 0 })))
    setRows(adj || [])
    setLoading(false)
  }, [month])
  useEffect(() => { load() }, [load])

  const feed = items.filter((p) => p.kind === 'feed')
  const packaging = items.filter((p) => p.kind === 'packaging')
  const lowItems = items.filter((p) => Number(p.reorder_point) > 0 && p.stock <= Number(p.reorder_point))
  const selected = items.find((p) => p.id === form.product_id)

  const openAdd = (product_id = '', direction = 'out') => { setForm({ ...empty, product_id, direction }); setModal(true) }

  const save = async (e) => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('stock_adjustments').insert({
      product_id: form.product_id, direction: form.direction, qty: Number(form.qty),
      reason: form.reason || null, date: form.date, created_by: user.id,
    })
    setSaving(false)
    if (error) { alert('تعذّر الحفظ: ' + error.message); return }
    setModal(false); load()
  }
  const remove = async (id) => {
    if (!confirm('حذف هذه الحركة؟')) return
    await supabase.from('stock_adjustments').delete().eq('id', id); load()
  }

  const Card = ({ p }) => {
    const low = Number(p.reorder_point) > 0 && p.stock <= Number(p.reorder_point)
    return (
      <div className={`stock-chip ${low ? 'low' : ''}`} style={{ gap: 6 }}>
        <span className="sc-name">{p.icon} {p.name}</span>
        <span className="sc-val mono">{fmtNum(p.stock)} <small style={{ fontSize: 12, fontWeight: 600 }}>{p.unit}</small></span>
        {Number(p.reorder_point) > 0 && (
          <span className="muted" style={{ fontSize: 11 }}>حد الطلب: {fmtNum(p.reorder_point)} {p.unit}</span>
        )}
        {low && <span className="badge badge-red" style={{ marginTop: 4 }}>⚠️ أعد الشراء</span>}
        <div className="row" style={{ gap: 5, marginTop: 6 }}>
          <button className="btn btn-danger btn-sm" onClick={() => openAdd(p.id, 'out')}>صرف</button>
          <button className="btn btn-ghost btn-sm" onClick={() => openAdd(p.id, 'in')}>توريد</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHead title="🏬 المخزن" subtitle="مخزون الأعلاف ومواد التعبئة: الصرف، التوريد، وتنبيه إعادة الطلب">
        <button className="btn btn-primary" onClick={() => openAdd()}>＋ حركة مخزون</button>
      </PageHead>

      {loading ? <Loader /> : (
        <>
          {lowItems.length > 0 && (
            <div className="card card-pad" style={{ marginBottom: 18, borderRight: '4px solid var(--red-600)', background: '#fff7f7' }}>
              <b style={{ color: 'var(--red-600)' }}>⚠️ أصناف بلغت حد إعادة الطلب:</b>
              <div style={{ marginTop: 6 }}>
                {lowItems.map((p) => (
                  <span key={p.id} className="badge badge-red" style={{ margin: '3px 4px' }}>
                    {p.icon} {p.name} — متبقٍّ {fmtNum(p.stock)} {p.unit}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="card card-pad" style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>🌾 الأعلاف</h3>
            {feed.length === 0 ? <EmptyState icon="🌾" title="لا توجد أصناف أعلاف" hint="أضفها من لوحة التحكم (نوع: علف)" />
              : <div className="stock-grid">{feed.map((p) => <Card key={p.id} p={p} />)}</div>}
          </div>

          {packaging.length > 0 && (
            <div className="card card-pad" style={{ marginBottom: 18 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>📦 مواد التعبئة</h3>
              <div className="stock-grid">{packaging.map((p) => <Card key={p.id} p={p} />)}</div>
            </div>
          )}

          <div className="row between center" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 16 }}>📋 سجل حركات المخزن</h3>
            <input className="input" type="month" value={month} dir="ltr" style={{ width: 160 }}
              onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="card">
            {rows.length === 0 ? <EmptyState icon="📋" title="لا توجد حركات هذا الشهر" /> : (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>التاريخ</th><th>الصنف</th><th>الحركة</th><th>الكمية</th><th>السبب</th><th></th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="mono">{fmtDate(r.date)}</td>
                        <td style={{ fontWeight: 600 }}>{r.products?.icon} {r.products?.name}</td>
                        <td><span className={`badge badge-${r.direction === 'in' ? 'green' : 'amber'}`}>
                          {r.direction === 'in' ? '⬆️ توريد' : '⬇️ صرف'}</span></td>
                        <td className="mono" style={{ fontWeight: 700, color: r.direction === 'in' ? 'var(--green-700)' : 'var(--earth-500)' }}>
                          {r.direction === 'in' ? '+' : '−'}{fmtNum(r.qty)} <span className="muted" style={{ fontWeight: 400 }}>{r.products?.unit}</span>
                        </td>
                        <td className="muted">{r.reason || '—'}</td>
                        <td><button className="btn btn-danger btn-sm" onClick={() => remove(r.id)}>حذف</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {modal && (
        <Modal title="حركة مخزون" onClose={() => setModal(false)}>
          <form onSubmit={save}>
            <div className="field">
              <label>الصنف</label>
              <select className="select" required value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                <option value="">— اختر الصنف —</option>
                {items.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.name} (متاح {fmtNum(p.stock)} {p.unit})</option>)}
              </select>
            </div>
            <div className="field">
              <label>نوع الحركة</label>
              <div className="seg" style={{ width: '100%' }}>
                <button type="button" className={`seg-btn ${form.direction === 'out' ? 'active' : ''}`} style={{ flex: 1 }}
                  onClick={() => setForm({ ...form, direction: 'out' })}>⬇️ صرف من المخزن</button>
                <button type="button" className={`seg-btn ${form.direction === 'in' ? 'active' : ''}`} style={{ flex: 1 }}
                  onClick={() => setForm({ ...form, direction: 'in' })}>⬆️ توريد للمخزن</button>
              </div>
            </div>
            <div className="row row-wrap" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label>الكمية {selected?.unit ? `(${selected.unit})` : ''}</label>
                <input className="input" type="number" min="0" step="0.01" required dir="ltr"
                  value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
              </div>
              <DateField value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            </div>
            <div className="field">
              <label>السبب / ملاحظة (اختياري)</label>
              <input className="input" value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="تغذية القطيع، توريد جديد…" />
            </div>
            <button className="btn btn-primary btn-block" disabled={saving}>
              {saving ? <span className="spinner" /> : 'حفظ الحركة'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
