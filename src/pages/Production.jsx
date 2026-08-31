import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PageHead, StatCard, EmptyState, Modal, Loader } from '../components/ui'
import DateField from '../components/DateField'
import { fmtNum, fmtDate, todayISO, monthRange } from '../lib/format'
import { loadProducts, loadStockMap } from '../lib/catalog'

const empty = { product_id: '', date: todayISO(), quantity: '', packaging_id: '', packaging_qty: '', note: '' }

export default function Production() {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [stock, setStock] = useState({})
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { start, end } = monthRange(month)
    const [p, s, { data: r }] = await Promise.all([
      loadProducts(), loadStockMap(),
      supabase.from('production')
        .select('*, products:product_id(name, icon, unit), pkg:packaging_id(name, unit)')
        .gte('date', start).lt('date', end).order('date', { ascending: false }),
    ])
    setProducts(p); setStock(s); setRows(r || []); setLoading(false)
  }, [month])
  useEffect(() => { load() }, [load])

  const producibles = products.filter((p) => p.kind === 'product' && p.is_active)
  const packagings = products.filter((p) => p.kind === 'packaging' && p.is_active)
  const trackables = products.filter((p) => p.track_stock)
  const selected = products.find((p) => p.id === form.product_id)

  // اختيار منتج له تعبئة افتراضية → خصم تلقائي بعدد المنتَج
  const onPickProduct = (id) => {
    const p = products.find((x) => x.id === id)
    setForm((f) => ({
      ...f, product_id: id,
      packaging_id: p?.packaging_id || (f.packaging_id || ''),
      packaging_qty: p?.packaging_id && f.quantity !== '' ? f.quantity : f.packaging_qty,
    }))
  }
  const onQty = (v) => {
    setForm((f) => {
      const sel = products.find((x) => x.id === f.product_id)
      const autoLinked = sel?.packaging_id && f.packaging_id === sel.packaging_id
      return { ...f, quantity: v, packaging_qty: autoLinked ? v : f.packaging_qty }
    })
  }

  const openAdd = () => { setForm({ ...empty }); setEditId(null); setModal(true) }
  const openEdit = (r) => {
    setForm({
      product_id: r.product_id || '', date: r.date, quantity: r.quantity,
      packaging_id: r.packaging_id || '', packaging_qty: r.packaging_qty ?? '', note: r.note || '',
    })
    setEditId(r.id); setModal(true)
  }

  const save = async (e) => {
    e.preventDefault(); setSaving(true)
    const payload = {
      product_id: form.product_id, date: form.date, quantity: Number(form.quantity),
      packaging_id: form.packaging_id || null,
      packaging_qty: form.packaging_id && form.packaging_qty !== '' ? Number(form.packaging_qty) : null,
      note: form.note || null,
    }
    let error
    if (editId) ({ error } = await supabase.from('production').update(payload).eq('id', editId))
    else ({ error } = await supabase.from('production').insert({ ...payload, created_by: user.id }))
    setSaving(false)
    if (error) { alert('خطأ أثناء الحفظ: ' + error.message); return }
    setModal(false); load()
  }

  const remove = async (id) => {
    if (!confirm('حذف هذا التسجيل؟')) return
    await supabase.from('production').delete().eq('id', id); load()
  }

  // إجمالي إنتاج الشهر لكل منتج
  const byProduct = useMemo(() => {
    const m = {}
    rows.forEach((r) => {
      const key = r.product_id
      m[key] = m[key] || { name: r.products?.name, icon: r.products?.icon, unit: r.products?.unit, qty: 0 }
      m[key].qty += Number(r.quantity)
    })
    return Object.values(m)
  }, [rows])

  const totalEntries = rows.length

  return (
    <div>
      <PageHead title="🧀 المنتجات والإنتاج" subtitle="تسجيل إنتاج مشتقات الألبان ومتابعة المخزون">
        <button className="btn btn-primary" onClick={openAdd} disabled={producibles.length === 0}>＋ تسجيل إنتاج</button>
      </PageHead>

      {/* المخزون الحالي */}
      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="row between center" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 16 }}>📦 المخزون الحالي</h3>
          <span className="muted" style={{ fontSize: 13 }}>رصيد البداية + الإنتاج/المشتريات − المبيعات/المستهلك</span>
        </div>
        {trackables.length === 0 ? (
          <EmptyState icon="📦" title="لا توجد أصناف بمخزون" hint="أضف منتجات من لوحة التحكم" />
        ) : (
          <div className="stock-grid">
            {trackables.map((p) => {
              const st = stock[p.id] ?? 0
              const low = st <= 0
              return (
                <div key={p.id} className={`stock-chip ${low ? 'low' : ''}`}>
                  <span className="sc-name">{p.icon} {p.name}</span>
                  <span className="sc-val mono">{fmtNum(st)} <small style={{ fontSize: 12, fontWeight: 600 }}>{p.unit}</small></span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 18 }}>
        <StatCard icon="🧾" label="تسجيلات الإنتاج (الشهر)" value={totalEntries} tone="blue" isMoney={false} />
        {byProduct.slice(0, 2).map((b, i) => (
          <StatCard key={i} icon={b.icon || '🧀'} label={`إنتاج ${b.name} (الشهر)`}
            value={`${fmtNum(b.qty)} ${b.unit || ''}`} tone="green" isMoney={false} />
        ))}
        <div className="card card-pad">
          <label style={{ fontWeight: 700, fontSize: 14 }}>عرض شهر</label>
          <input className="input" type="month" value={month} dir="ltr"
            onChange={(e) => setMonth(e.target.value)} style={{ marginTop: 8 }} />
        </div>
      </div>

      <div className="card">
        {loading ? <Loader /> : rows.length === 0 ? (
          <EmptyState icon="🧀" title="لا توجد تسجيلات إنتاج هذا الشهر" hint="اضغط «تسجيل إنتاج» للبدء" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>التاريخ</th><th>المنتج</th><th>الكمية المنتَجة</th><th>علب مستهلكة</th><th>ملاحظة</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{fmtDate(r.date)}</td>
                    <td style={{ fontWeight: 600 }}>{r.products?.icon} {r.products?.name || '—'}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{fmtNum(r.quantity)} <span className="muted" style={{ fontWeight: 400 }}>{r.products?.unit}</span></td>
                    <td className="mono muted">{r.packaging_qty ? `${fmtNum(r.packaging_qty)} ${r.pkg?.name || ''}` : '—'}</td>
                    <td className="muted">{r.note || '—'}</td>
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
        <Modal title={editId ? 'تعديل إنتاج' : 'تسجيل إنتاج'} onClose={() => setModal(false)}>
          <form onSubmit={save}>
            <div className="field">
              <label>المنتج</label>
              <select className="select" required value={form.product_id}
                onChange={(e) => onPickProduct(e.target.value)}>
                <option value="">— اختر المنتج —</option>
                {producibles.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.name} ({p.unit || 'بلا وحدة'})</option>)}
              </select>
            </div>
            <div className="row row-wrap" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 150 }}>
                <label>الكمية المنتَجة {selected?.unit ? `(${selected.unit})` : ''}</label>
                <input className="input" type="number" min="0" step="0.01" required dir="ltr"
                  value={form.quantity} onChange={(e) => onQty(e.target.value)} />
              </div>
              <DateField value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            </div>

            {packagings.length > 0 && (
              <div className="card card-pad" style={{ background: 'var(--green-50)', marginBottom: 16 }}>
                <div className="muted" style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🥤 علب التعبئة المستهلكة (اختياري)</div>
                <div className="row row-wrap" style={{ gap: 12 }}>
                  <div className="field" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
                    <label>نوع العلبة</label>
                    <select className="select" value={form.packaging_id}
                      onChange={(e) => setForm({ ...form, packaging_id: e.target.value })}>
                      <option value="">— لا شيء —</option>
                      {packagings.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.name} (متاح {fmtNum(stock[p.id] ?? 0)})</option>)}
                    </select>
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 120, marginBottom: 0 }}>
                    <label>العدد المستهلك</label>
                    <input className="input" type="number" min="0" step="1" dir="ltr" disabled={!form.packaging_id}
                      value={form.packaging_qty} onChange={(e) => setForm({ ...form, packaging_qty: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            <div className="field">
              <label>ملاحظة (اختياري)</label>
              <textarea className="input" value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <button className="btn btn-primary btn-block" disabled={saving}>
              {saving ? <span className="spinner" /> : (editId ? 'حفظ التعديل' : 'حفظ الإنتاج')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
