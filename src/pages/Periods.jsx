import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PageHead, StatCard, EmptyState, Loader } from '../components/ui'
import { fmtRiyal, fmtNum, fmtDate, todayISO, monthName } from '../lib/format'
import { KINDS, loadProducts, loadStockMap } from '../lib/catalog'

const monthLabel = (m) => `${monthName(Number(m.slice(5, 7)) - 1)} ${m.slice(0, 4)}`
const nextMonth = (m) => {
  const [y, mo] = m.split('-').map(Number)
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
}

export default function Periods() {
  const { user } = useAuth()
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [period, setPeriod] = useState(null)
  const [openingCash, setOpeningCash] = useState('')
  const [sums, setSums] = useState({ rev: 0, exp: 0 })
  const [stock, setStock] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const start = `${month}-01`
    const end = `${nextMonth(month)}-01`
    const [{ data: per }, { data: rev }, { data: exp }, prods, stockMap, { data: hist }] = await Promise.all([
      supabase.from('periods').select('*').eq('month', month).maybeSingle(),
      supabase.from('revenues').select('amount').gte('date', start).lt('date', end),
      supabase.from('expenses').select('amount').gte('date', start).lt('date', end),
      loadProducts(), loadStockMap(),
      supabase.from('periods').select('*').order('month', { ascending: false }),
    ])
    setPeriod(per || null)
    setOpeningCash(per ? String(per.opening_cash) : '')
    setSums({
      rev: (rev || []).reduce((s, r) => s + Number(r.amount), 0),
      exp: (exp || []).reduce((s, r) => s + Number(r.amount), 0),
    })
    setStock((prods || []).filter((p) => p.track_stock).map((p) => ({ ...p, stock: stockMap[p.id] ?? 0 })))
    setHistory(hist || [])
    setLoading(false)
  }, [month])
  useEffect(() => { load() }, [load])

  const net = sums.rev - sums.exp
  const opening = Number(openingCash || 0)
  const closing = opening + net
  const isClosed = period?.status === 'closed'

  const saveOpening = async () => {
    setSaving(true)
    const { error } = await supabase.from('periods')
      .upsert({ month, opening_cash: Number(openingCash || 0), created_by: user.id }, { onConflict: 'month' })
    setSaving(false)
    if (error) { alert('تعذّر الحفظ: ' + error.message); return }
    load()
  }

  const closeMonth = async () => {
    if (!confirm(`إقفال شهر ${monthLabel(month)}؟ سيُرحَّل الرصيد النقدي (${fmtRiyal(closing)}) كرصيد افتتاحي للشهر التالي.`)) return
    setSaving(true)
    // 1) احفظ/أقفل الشهر الحالي
    await supabase.from('periods').upsert(
      { month, opening_cash: Number(openingCash || 0), status: 'closed', closed_at: new Date().toISOString(), created_by: user.id },
      { onConflict: 'month' })
    // 2) افتح الشهر التالي برصيد الإقفال
    const nm = nextMonth(month)
    const { data: existing } = await supabase.from('periods').select('id, status').eq('month', nm).maybeSingle()
    if (existing) {
      await supabase.from('periods').update({ opening_cash: closing }).eq('month', nm)
    } else {
      await supabase.from('periods').insert({ month: nm, opening_cash: closing, created_by: user.id })
    }
    setSaving(false)
    load()
  }

  const reopen = async () => {
    if (!confirm('إعادة فتح هذا الشهر للتعديل؟')) return
    await supabase.from('periods').update({ status: 'open', closed_at: null }).eq('month', month)
    load()
  }

  const byKind = (k) => stock.filter((p) => p.kind === k)
  const groups = [
    { k: 'product', title: '🧀 المنتجات' },
    { k: 'feed', title: '🌾 الأعلاف' },
    { k: 'packaging', title: '📦 التعبئة والتغليف' },
  ]

  return (
    <div>
      <PageHead title="🗓️ الفترات والإقفال الشهري" subtitle="الرصيد الافتتاحي، ملخّص الشهر، وترحيل الإقفال للشهر التالي — للمالك فقط">
        <input className="input" type="month" value={month} dir="ltr" style={{ width: 170 }}
          onChange={(e) => setMonth(e.target.value)} />
      </PageHead>

      {loading ? <Loader /> : (
        <>
          {isClosed && (
            <div className="badge badge-green" style={{ padding: '8px 14px', marginBottom: 14 }}>
              🔒 هذا الشهر مُقفل — {period.closed_at && fmtDate(period.closed_at)}
            </div>
          )}

          {/* الرصيد النقدي */}
          <div className="card card-pad" style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>💵 الرصيد النقدي — {monthLabel(month)}</h3>
            <div className="row row-wrap center" style={{ gap: 14 }}>
              <div className="field" style={{ margin: 0, flex: 1, minWidth: 180 }}>
                <label>رصيد أول المدة (نقد)</label>
                <div className="row" style={{ gap: 8 }}>
                  <input className="input" type="number" min="0" step="0.01" dir="ltr" disabled={isClosed}
                    value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} placeholder="0" />
                  {!isClosed && <button className="btn btn-ghost" onClick={saveOpening} disabled={saving}>حفظ</button>}
                </div>
              </div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginTop: 16 }}>
              <StatCard icon="💰" label="إيرادات الشهر" value={sums.rev} tone="green" />
              <StatCard icon="🧾" label="منصرفات الشهر" value={sums.exp} tone="red" />
              <StatCard icon={net >= 0 ? '📈' : '📉'} label="صافي الحركة" value={net} tone={net >= 0 ? 'green' : 'red'} />
              <StatCard icon="🏦" label="رصيد آخر المدة (إقفال)" value={closing} tone="blue" sub="أول المدة + الصافي" />
            </div>
            <div className="row" style={{ gap: 8, marginTop: 16 }}>
              {isClosed
                ? <button className="btn btn-ghost" onClick={reopen}>🔓 إعادة فتح الشهر</button>
                : <button className="btn btn-primary" onClick={closeMonth} disabled={saving}>🔒 إقفال الشهر وترحيل الرصيد</button>}
            </div>
          </div>

          {/* لقطة المخزون */}
          <div className="card card-pad" style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, marginBottom: 4 }}>📦 المخزون الحالي</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>رصيد بداية المدة يُضبط لكل صنف من «لوحة التحكم ← الأصناف».</p>
            {stock.length === 0 ? <EmptyState icon="📦" title="لا توجد أصناف بمخزون" /> : (
              <div className="grid" style={{ gap: 16 }}>
                {groups.map((g) => {
                  const items = byKind(g.k)
                  if (items.length === 0) return null
                  return (
                    <div key={g.k}>
                      <div className="muted" style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{g.title}</div>
                      <div className="stock-grid">
                        {items.map((p) => {
                          const low = p.stock <= 0
                          return (
                            <div key={p.id} className={`stock-chip ${low ? 'low' : ''}`}>
                              <span className="sc-name">{p.icon} {p.name}</span>
                              <span className="sc-val mono">{fmtNum(p.stock)} <small style={{ fontSize: 12, fontWeight: 600 }}>{p.unit}</small></span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* سجل الفترات */}
          <div className="card">
            <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ fontSize: 16 }}>📚 سجل الفترات</h3>
            </div>
            {history.length === 0 ? <EmptyState icon="📚" title="لا توجد فترات محفوظة بعد" /> : (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>الشهر</th><th>رصيد أول المدة</th><th>الحالة</th><th>تاريخ الإقفال</th></tr></thead>
                  <tbody>
                    {history.map((p) => (
                      <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setMonth(p.month)}>
                        <td style={{ fontWeight: 600 }}>{monthLabel(p.month)}</td>
                        <td className="mono">{fmtRiyal(p.opening_cash)}</td>
                        <td>{p.status === 'closed'
                          ? <span className="badge badge-green">🔒 مُقفل</span>
                          : <span className="badge badge-amber">مفتوح</span>}</td>
                        <td className="mono muted">{p.closed_at ? fmtDate(p.closed_at) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
