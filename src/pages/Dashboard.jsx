import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PageHead, StatCard, Loader, EmptyState } from '../components/ui'
import { fmtRiyal, fmtNum, monthName, CHART_COLORS } from '../lib/format'
import { loadProducts, loadStockMap } from '../lib/catalog'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'

// أول يوم في الشهر قبل n أشهر
function monthStart(offset = 0) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - offset)
  return d
}
const iso = (d) => d.toISOString().slice(0, 10)

export default function Dashboard() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const from = iso(monthStart(5))          // آخر 6 أشهر
      const monthFrom = iso(monthStart(0))
      const [{ data: exp }, { data: rev }, { data: prod }, products, stockMap] = await Promise.all([
        supabase.from('expenses').select('amount, date').gte('date', from),
        supabase.from('revenues').select('amount, date').gte('date', from),
        supabase.from('production').select('quantity, date, products:product_id(name)').gte('date', monthFrom),
        loadProducts(),
        loadStockMap(),
      ])

      // تجميع شهري
      const buckets = {}
      for (let i = 5; i >= 0; i--) {
        const d = monthStart(i)
        const key = iso(d).slice(0, 7)
        buckets[key] = { key, name: monthName(d.getMonth()), إيرادات: 0, منصرفات: 0 }
      }
      ;(rev || []).forEach((r) => { const k = r.date.slice(0, 7); if (buckets[k]) buckets[k].إيرادات += Number(r.amount) })
      ;(exp || []).forEach((r) => { const k = r.date.slice(0, 7); if (buckets[k]) buckets[k].منصرفات += Number(r.amount) })

      const monthKey = monthFrom.slice(0, 7)
      const mRev = (rev || []).filter((r) => r.date.slice(0, 7) === monthKey).reduce((s, r) => s + Number(r.amount), 0)
      const mExp = (exp || []).filter((r) => r.date.slice(0, 7) === monthKey).reduce((s, r) => s + Number(r.amount), 0)
      const mMilk = (prod || [])
        .filter((r) => r.products?.name === 'حليب')
        .reduce((s, r) => s + Number(r.quantity), 0)

      // مخزون المنتجات المتتبَّعة
      const stockRows = (products || [])
        .filter((p) => p.track_stock)
        .map((p) => ({ ...p, stock: stockMap[p.id] ?? 0 }))

      setData({
        chart: Object.values(buckets),
        mRev, mExp, mNet: mRev - mExp, mMilk, stockRows,
      })
      setLoading(false)
    })()
  }, [])

  if (loading) return <Loader />

  const net = data.mNet
  return (
    <div>
      <PageHead
        title={`مرحباً، ${profile?.full_name || ''} 👋`}
        subtitle="نظرة عامة على أداء المزرعة هذا الشهر" />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginBottom: 20 }}>
        <StatCard icon="💰" label="إيرادات هذا الشهر" value={data.mRev} tone="green" />
        <StatCard icon="🧾" label="منصرفات هذا الشهر" value={data.mExp} tone="red" />
        <StatCard icon={net >= 0 ? '📈' : '📉'} label="صافي الربح"
          value={net} tone={net >= 0 ? 'green' : 'red'}
          sub={net >= 0 ? 'المزرعة رابحة هذا الشهر' : 'المنصرفات تجاوزت الإيرادات'} />
        <StatCard icon="🥛" label="إنتاج الحليب" value={`${fmtNum(data.mMilk)} لتر`} tone="blue" isMoney={false} />
      </div>

      {data.stockRows.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div className="row between center" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 17 }}>📦 المخزون الحالي</h3>
            <span className="muted" style={{ fontSize: 13 }}>المتاح من المنتجات ومواد التعبئة</span>
          </div>
          <div className="stock-grid">
            {data.stockRows.map((p) => {
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
      )}

      <div className="card card-pad">
        <h3 style={{ fontSize: 17, marginBottom: 4 }}>الإيرادات مقابل المنصرفات</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>آخر 6 أشهر</p>
        {data.chart.every((m) => m.إيرادات === 0 && m.منصرفات === 0) ? (
          <EmptyState icon="📊" title="لا توجد بيانات بعد" hint="ابدأ بتسجيل الإيرادات والمنصرفات" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.chart} margin={{ top: 5, right: 5, left: -5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2ee" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => fmtNum(v)} />
              <Tooltip formatter={(v, n) => [fmtRiyal(v), n]}
                contentStyle={{ borderRadius: 12, border: '1px solid #e3e9e3', fontFamily: 'Cairo' }} />
              <Legend wrapperStyle={{ fontFamily: 'Cairo', fontSize: 13 }} />
              <Bar dataKey="إيرادات" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
              <Bar dataKey="منصرفات" fill={CHART_COLORS[3]} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
