import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { PageHead, EmptyState, Modal, Loader } from '../components/ui'
import { fmtNum, fmtRiyal } from '../lib/format'
import { KINDS, loadProducts, loadUnits, loadStockMap } from '../lib/catalog'

const TABS = [
  { key: 'products', label: 'الأصناف والمنتجات', icon: '🧀' },
  { key: 'expenses', label: 'فئات المنصرفات', icon: '🧾' },
  { key: 'units', label: 'وحدات القياس', icon: '📏' },
]

const emptyProduct = {
  name: '', icon: '📦', kind: 'product', unit: '', sale_price: '',
  opening_qty: '', opening_date: '', is_active: true, sort_order: 0,
}
const emptyCat = { name: '', icon: '📦', sort_order: 0 }
const emptyUnit = { name: '', sort_order: 0 }

export default function ControlPanel() {
  const [tab, setTab] = useState('products')
  return (
    <div>
      <PageHead title="🛠️ لوحة التحكم" subtitle="إدارة الأصناف والمنتجات والفئات ووحدات القياس — للمالك فقط" />
      <div className="seg" style={{ marginBottom: 18 }}>
        {TABS.map((t) => (
          <button key={t.key}
            className={`seg-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>
      {tab === 'products' && <ProductsTab />}
      {tab === 'expenses' && <ExpenseCatsTab />}
      {tab === 'units' && <UnitsTab />}
    </div>
  )
}

/* ============================ المنتجات والأصناف ============================ */
function ProductsTab() {
  const [rows, setRows] = useState([])
  const [units, setUnits] = useState([])
  const [stock, setStock] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyProduct)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const [p, u, s] = await Promise.all([loadProducts(), loadUnits(), loadStockMap()])
    setRows(p); setUnits(u); setStock(s); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const openAdd = () => { setForm({ ...emptyProduct }); setEditId(null); setModal(true) }
  const openEdit = (r) => {
    setForm({
      name: r.name, icon: r.icon || '📦', kind: r.kind, unit: r.unit || '',
      sale_price: r.sale_price ?? '', opening_qty: r.opening_qty ?? '',
      opening_date: r.opening_date || '', is_active: r.is_active, sort_order: r.sort_order || 0,
    })
    setEditId(r.id); setModal(true)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name.trim(), icon: form.icon || null, kind: form.kind,
      unit: form.unit || null,
      sale_price: form.sale_price === '' ? null : Number(form.sale_price),
      opening_qty: form.opening_qty === '' ? 0 : Number(form.opening_qty),
      opening_date: form.opening_date || null,
      is_active: form.is_active, sort_order: Number(form.sort_order) || 0,
    }
    let error
    if (editId) ({ error } = await supabase.from('products').update(payload).eq('id', editId))
    else ({ error } = await supabase.from('products').insert(payload))
    setSaving(false)
    if (error) {
      alert(error.code === '23505' ? 'يوجد صنف بنفس الاسم.' : 'خطأ أثناء الحفظ: ' + error.message)
      return
    }
    setModal(false); load()
  }

  const remove = async (id) => {
    if (!confirm('حذف هذا الصنف؟ (لن تُحذف الحركات المرتبطة، ستصبح بلا صنف)')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { alert('تعذّر الحذف: ' + error.message); return }
    load()
  }

  const shown = rows.filter((r) => filter === 'all' || r.kind === filter)
  const counts = {
    all: rows.length,
    product: rows.filter((r) => r.kind === 'product').length,
    packaging: rows.filter((r) => r.kind === 'packaging').length,
    other: rows.filter((r) => r.kind === 'other').length,
  }

  return (
    <div>
      <div className="row between center row-wrap" style={{ gap: 10, marginBottom: 14 }}>
        <div className="seg seg-sm">
          {[['all', 'الكل'], ['product', 'منتجات'], ['packaging', 'تعبئة'], ['other', 'أخرى']].map(([k, l]) => (
            <button key={k} className={`seg-btn ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
              {l} <span className="muted">({counts[k]})</span>
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={openAdd}>＋ صنف جديد</button>
      </div>

      <div className="card">
        {loading ? <Loader /> : shown.length === 0 ? (
          <EmptyState icon="🧀" title="لا توجد أصناف" hint="أضف أول صنف" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>الصنف</th><th>النوع</th><th>الوحدة</th><th>سعر البيع</th>
                  <th>رصيد البداية</th><th>المخزون الحالي</th><th>الحالة</th><th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const k = KINDS[r.kind]
                  const st = stock[r.id]
                  const low = r.track_stock && st != null && st <= 0
                  return (
                    <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.55 }}>
                      <td style={{ fontWeight: 600 }}>{r.icon} {r.name}</td>
                      <td><span className={`badge badge-${k.color}`}>{k.label}</span></td>
                      <td className="muted">{r.unit || '—'}</td>
                      <td className="mono">{r.sale_price != null ? fmtRiyal(r.sale_price) : '—'}</td>
                      <td className="mono muted">{r.track_stock ? fmtNum(r.opening_qty) : '—'}</td>
                      <td className="mono" style={{ fontWeight: 700, color: low ? 'var(--red-600)' : 'var(--green-700)' }}>
                        {r.track_stock ? `${fmtNum(st ?? 0)} ${r.unit || ''}` : '—'}
                      </td>
                      <td>{r.is_active
                        ? <span className="badge badge-green">مُفعّل</span>
                        : <span className="badge badge-red">موقوف</span>}</td>
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
        <Modal title={editId ? 'تعديل صنف' : 'صنف جديد'} onClose={() => setModal(false)}>
          <form onSubmit={save}>
            <div className="row row-wrap" style={{ gap: 12 }}>
              <div className="field" style={{ width: 90 }}>
                <label>الأيقونة</label>
                <input className="input" style={{ textAlign: 'center', fontSize: 20 }} value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                <label>اسم الصنف</label>
                <input className="input" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="حليب، زبدة، علبة لتر…" />
              </div>
            </div>
            <div className="row row-wrap" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 150 }}>
                <label>النوع (التصنيف)</label>
                <select className="select" value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: 1, minWidth: 150 }}>
                <label>وحدة القياس</label>
                <select className="select" value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  <option value="">— بلا وحدة —</option>
                  {units.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div className="row row-wrap" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label>سعر البيع الافتراضي (﷼)</label>
                <input className="input" type="number" min="0" step="0.01" dir="ltr" value={form.sale_price}
                  onChange={(e) => setForm({ ...form, sale_price: e.target.value })} placeholder="اختياري" />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 130 }}>
                <label>رصيد بداية المدة</label>
                <input className="input" type="number" min="0" step="0.01" dir="ltr" value={form.opening_qty}
                  onChange={(e) => setForm({ ...form, opening_qty: e.target.value })} placeholder="0" />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 130 }}>
                <label>تاريخ الرصيد</label>
                <input className="input" type="date" dir="ltr" value={form.opening_date}
                  onChange={(e) => setForm({ ...form, opening_date: e.target.value })} />
              </div>
            </div>
            <label className="row center" style={{ gap: 8, cursor: 'pointer', marginBottom: 4 }}>
              <input type="checkbox" checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <span>مُفعّل (يظهر في قوائم الإنتاج والبيع)</span>
            </label>
            <button className="btn btn-primary btn-block" disabled={saving}>
              {saving ? <span className="spinner" /> : (editId ? 'حفظ التعديل' : 'إضافة الصنف')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ============================ فئات المنصرفات ============================ */
function ExpenseCatsTab() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyCat)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('expense_categories').select('*').order('sort_order')
    setRows(data || []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const openAdd = () => { setForm({ ...emptyCat, sort_order: (rows.at(-1)?.sort_order || 0) + 1 }); setEditId(null); setModal(true) }
  const openEdit = (r) => { setForm({ name: r.name, icon: r.icon || '📦', sort_order: r.sort_order || 0 }); setEditId(r.id); setModal(true) }

  const save = async (e) => {
    e.preventDefault(); setSaving(true)
    const payload = { name: form.name.trim(), icon: form.icon || null, sort_order: Number(form.sort_order) || 0 }
    let error
    if (editId) ({ error } = await supabase.from('expense_categories').update(payload).eq('id', editId))
    else ({ error } = await supabase.from('expense_categories').insert(payload))
    setSaving(false)
    if (error) { alert('خطأ أثناء الحفظ: ' + error.message); return }
    setModal(false); load()
  }
  const remove = async (id) => {
    if (!confirm('حذف هذه الفئة؟')) return
    await supabase.from('expense_categories').delete().eq('id', id); load()
  }

  return (
    <div>
      <div className="row between" style={{ marginBottom: 14 }}>
        <div />
        <button className="btn btn-primary" onClick={openAdd}>＋ فئة جديدة</button>
      </div>
      <div className="card">
        {loading ? <Loader /> : rows.length === 0 ? (
          <EmptyState icon="🧾" title="لا توجد فئات" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>#</th><th>الفئة</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono muted">{r.sort_order}</td>
                    <td style={{ fontWeight: 600 }}>{r.icon} {r.name}</td>
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
        <Modal title={editId ? 'تعديل فئة' : 'فئة منصرفات جديدة'} onClose={() => setModal(false)}>
          <form onSubmit={save}>
            <div className="row row-wrap" style={{ gap: 12 }}>
              <div className="field" style={{ width: 90 }}>
                <label>الأيقونة</label>
                <input className="input" style={{ textAlign: 'center', fontSize: 20 }} value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 150 }}>
                <label>اسم الفئة</label>
                <input className="input" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="أعلاف، صيانة…" />
              </div>
              <div className="field" style={{ width: 90 }}>
                <label>الترتيب</label>
                <input className="input" type="number" dir="ltr" value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
              </div>
            </div>
            <button className="btn btn-primary btn-block" disabled={saving}>
              {saving ? <span className="spinner" /> : (editId ? 'حفظ' : 'إضافة')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ============================ وحدات القياس ============================ */
function UnitsTab() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyUnit)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('units').select('*').order('sort_order')
    setRows(data || []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const openAdd = () => { setForm({ ...emptyUnit, sort_order: (rows.at(-1)?.sort_order || 0) + 1 }); setEditId(null); setModal(true) }
  const openEdit = (r) => { setForm({ name: r.name, sort_order: r.sort_order || 0 }); setEditId(r.id); setModal(true) }

  const save = async (e) => {
    e.preventDefault(); setSaving(true)
    const payload = { name: form.name.trim(), sort_order: Number(form.sort_order) || 0 }
    let error
    if (editId) ({ error } = await supabase.from('units').update(payload).eq('id', editId))
    else ({ error } = await supabase.from('units').insert(payload))
    setSaving(false)
    if (error) { alert(error.code === '23505' ? 'الوحدة موجودة مسبقاً.' : 'خطأ: ' + error.message); return }
    setModal(false); load()
  }
  const remove = async (id) => {
    if (!confirm('حذف هذه الوحدة؟')) return
    await supabase.from('units').delete().eq('id', id); load()
  }

  return (
    <div>
      <div className="row between" style={{ marginBottom: 14 }}>
        <div />
        <button className="btn btn-primary" onClick={openAdd}>＋ وحدة جديدة</button>
      </div>
      <div className="card">
        {loading ? <Loader /> : rows.length === 0 ? (
          <EmptyState icon="📏" title="لا توجد وحدات" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>#</th><th>الوحدة</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono muted">{r.sort_order}</td>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
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
        <Modal title={editId ? 'تعديل وحدة' : 'وحدة قياس جديدة'} onClose={() => setModal(false)}>
          <form onSubmit={save}>
            <div className="row row-wrap" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 150 }}>
                <label>اسم الوحدة</label>
                <input className="input" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="لتر، علبة، كجم…" />
              </div>
              <div className="field" style={{ width: 90 }}>
                <label>الترتيب</label>
                <input className="input" type="number" dir="ltr" value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
              </div>
            </div>
            <button className="btn btn-primary btn-block" disabled={saving}>
              {saving ? <span className="spinner" /> : (editId ? 'حفظ' : 'إضافة')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
