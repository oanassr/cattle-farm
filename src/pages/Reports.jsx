import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { PageHead, StatCard, Loader, EmptyState } from '../components/ui'
import { fmtRiyal, fmtNum, fmtMoney, fmtDate, monthName, CHART_COLORS } from '../lib/format'
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import './Reports.css'

const iso = (d) => d.toISOString().slice(0, 10)
function defaultRange() {
  const to = new Date()
  const from = new Date(); from.setMonth(from.getMonth() - 5); from.setDate(1)
  return { from: iso(from), to: iso(to) }
}

export default function Reports() {
  const [range, setRange] = useState(defaultRange())
  const [loading, setLoading] = useState(true)
  const [rep, setRep] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = range
    const [exp, rev, prodQ] = await Promise.all([
      supabase.from('expenses').select('amount, date, note, payment_method, expense_categories(name, icon)').gte('date', from).lte('date', to),
      supabase.from('revenues').select('amount, date, quantity, unit, buyer_name, payment_method, products:product_id(name, icon, unit), revenue_categories(name, icon)').gte('date', from).lte('date', to),
      supabase.from('production').select('quantity, date, products:product_id(name, icon, unit)').gte('date', from).lte('date', to),
    ])
    const E = exp.data || [], R = rev.data || [], M = prodQ.data || []

    const totalExp = E.reduce((s, r) => s + Number(r.amount), 0)
    const totalRev = R.reduce((s, r) => s + Number(r.amount), 0)

    // إنتاج كل المنتجات + مكافئ «علبة اللبن» (كل علبة سمن/زبدة = 10 علب لبن)
    const EQUIV = { 'لبن': 1, 'سمن': 10, 'زبدة': 10 }
    const prodMap = {}
    M.forEach((r) => {
      const n = r.products?.name || '—'
      prodMap[n] = prodMap[n] || { name: n, icon: r.products?.icon || '', unit: r.products?.unit || '', qty: 0 }
      prodMap[n].qty += Number(r.quantity)
    })
    const prodByProduct = Object.values(prodMap).sort((a, b) => b.qty - a.qty)
    const totalMilk = prodMap['حليب']?.qty || 0
    const totalLabanEquiv = M.reduce((s, r) => s + Number(r.quantity) * (EQUIV[r.products?.name] ?? 0), 0)
    const costPerCan = totalLabanEquiv ? totalExp / totalLabanEquiv : 0

    const net = totalRev - totalExp
    const margin = totalRev ? (net / totalRev) * 100 : 0

    // اتجاه شهري
    const months = {}
    const ensure = (k) => (months[k] = months[k] || {
      key: k, name: `${monthName(Number(k.slice(5, 7)) - 1)}`, إيرادات: 0, منصرفات: 0, صافي: 0,
    })
    R.forEach((r) => { const m = ensure(r.date.slice(0, 7)); m.إيرادات += Number(r.amount) })
    E.forEach((r) => { const m = ensure(r.date.slice(0, 7)); m.منصرفات += Number(r.amount) })
    const trend = Object.values(months).sort((a, b) => a.key.localeCompare(b.key))
      .map((m) => ({ ...m, صافي: m.إيرادات - m.منصرفات }))

    // تفصيل الفئات
    const groupBy = (arr, keyName) => {
      const g = {}
      arr.forEach((r) => {
        const name = r[keyName]?.name || 'غير مصنّف'
        const icon = r[keyName]?.icon || ''
        g[name] = g[name] || { name, icon, value: 0 }
        g[name].value += Number(r.amount)
      })
      return Object.values(g).sort((a, b) => b.value - a.value)
    }
    const expByCat = groupBy(E, 'expense_categories')
    // الإيرادات حسب الصنف (المنتج أولاً، ثم الفئة القديمة للبيانات السابقة)
    const revGroups = {}
    R.forEach((r) => {
      const src = r.products || r.revenue_categories
      const name = src?.name || 'غير مصنّف'
      const icon = src?.icon || ''
      revGroups[name] = revGroups[name] || { name, icon, value: 0 }
      revGroups[name].value += Number(r.amount)
    })
    const revByCat = Object.values(revGroups).sort((a, b) => b.value - a.value)

    // تفاصيل المنصرفات بأوصافها (تظهر في التقرير وعند الطباعة)
    const expDetail = E.map((r) => ({
      date: r.date, cat: r.expense_categories?.name || 'غير مصنّف', icon: r.expense_categories?.icon || '',
      note: r.note || '', amount: Number(r.amount),
    })).sort((a, b) => b.date.localeCompare(a.date))

    const revDetail = R.map((r) => ({
      date: r.date,
      item: r.products?.name || r.revenue_categories?.name || 'غير مصنّف',
      icon: r.products?.icon || r.revenue_categories?.icon || '',
      qty: r.quantity, unit: r.products?.unit || r.unit || '',
      buyer: r.buyer_name || '', amount: Number(r.amount),
    })).sort((a, b) => b.date.localeCompare(a.date))

    setRep({
      totalExp, totalRev, totalMilk, net, margin, costPerCan, totalLabanEquiv,
      prodByProduct, expDetail, revDetail, trend, expByCat, revByCat, expCount: E.length, revCount: R.length,
    })
    setLoading(false)
  }, [range])

  useEffect(() => { load() }, [load])

  const exportCSV = () => {
    if (!rep) return
    const lines = [
      ['التقرير المالي لمزرعة الأبقار'],
      [`الفترة من ${range.from} إلى ${range.to}`],
      [],
      ['المؤشر', 'القيمة'],
      ['إجمالي الإيرادات', fmtMoney(rep.totalRev)],
      ['إجمالي المنصرفات', fmtMoney(rep.totalExp)],
      ['صافي الربح', fmtMoney(rep.net)],
      ['هامش الربح %', fmtNum(rep.margin)],
      ['الإنتاج بمكافئ علبة اللبن', fmtMoney(rep.totalLabanEquiv)],
      ['تكلفة العلبة (تقديري)', fmtMoney(rep.costPerCan)],
      [],
      ['إنتاج المنتجات', 'الكمية', 'الوحدة'],
      ...rep.prodByProduct.map((p) => [p.name, fmtMoney(p.qty), p.unit]),
      [],
      ['المنصرفات حسب الفئة'],
      ...rep.expByCat.map((c) => [c.name, fmtMoney(c.value)]),
      [],
      ['الإيرادات حسب الصنف'],
      ...rep.revByCat.map((c) => [c.name, fmtMoney(c.value)]),
      [],
      ['تفاصيل المنصرفات', 'التاريخ', 'الفئة', 'الوصف', 'المبلغ'],
      ...rep.expDetail.map((r) => ['', r.date, r.cat, r.note, fmtMoney(r.amount)]),
      [],
      ['تفاصيل المبيعات', 'التاريخ', 'الصنف', 'الكمية', 'المشتري', 'المبلغ'],
      ...rep.revDetail.map((r) => ['', r.date, r.item, r.qty ?? '', r.buyer, fmtMoney(r.amount)]),
    ]
    const csv = '﻿' + lines.map((l) => l.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url; a.download = `تقرير-المزرعة-${range.from}_${range.to}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHead title="📊 التقارير التفصيلية" subtitle="تحليل شامل لأداء المزرعة المالي والإنتاجي">
        <div className="row row-wrap no-print" style={{ gap: 8 }}>
          <button className="btn btn-ghost" onClick={exportCSV}>⬇️ تصدير CSV</button>
          <button className="btn btn-primary" onClick={() => window.print()}>🖨️ طباعة / PDF</button>
        </div>
      </PageHead>

      <div className="card card-pad no-print" style={{ marginBottom: 18 }}>
        <div className="row row-wrap center" style={{ gap: 16 }}>
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 150 }}>
            <label>من تاريخ</label>
            <input className="input" type="date" dir="ltr" value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 150 }}>
            <label>إلى تاريخ</label>
            <input className="input" type="date" dir="ltr" value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="print-title" style={{ display: 'none' }}>
        <h1>التقرير المالي لمزرعة الأبقار</h1>
        <p>الفترة من {range.from} إلى {range.to}</p>
      </div>

      {loading ? <Loader /> : !rep ? null : (
        <div className="report-body">
          {/* المؤشرات */}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 18 }}>
            <StatCard icon="💰" label="إجمالي الإيرادات" value={rep.totalRev} tone="green" sub={`${rep.revCount} عملية`} />
            <StatCard icon="🧾" label="إجمالي المنصرفات" value={rep.totalExp} tone="red" sub={`${rep.expCount} عملية`} />
            <StatCard icon={rep.net >= 0 ? '📈' : '📉'} label="صافي الربح" value={rep.net} tone={rep.net >= 0 ? 'green' : 'red'} />
            <StatCard icon="🎯" label="هامش الربح" value={`${fmtNum(rep.margin)}%`} tone={rep.margin >= 0 ? 'green' : 'red'} isMoney={false} />
            <StatCard icon="🧴" label="الإنتاج (مكافئ علبة لبن)" value={`${fmtNum(rep.totalLabanEquiv)} علبة`} tone="blue" isMoney={false} sub="سمن/زبدة = 10 علب لبن" />
            <StatCard icon="⚖️" label="تكلفة العلبة (تقديري)" value={rep.costPerCan} tone="amber" sub="المنصرفات ÷ مكافئ اللبن" />
          </div>

          {/* اتجاه الأرباح */}
          <div className="card card-pad" style={{ marginBottom: 18 }}>
            <h3 className="rep-h">تطوّر الأرباح والخسائر شهرياً</h3>
            {rep.trend.length === 0 ? <EmptyState icon="📊" title="لا توجد بيانات في هذه الفترة" /> : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={rep.trend} margin={{ top: 5, right: 5, left: -5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2ee" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => fmtNum(v)} />
                  <Tooltip formatter={(v, n) => [fmtRiyal(v), n]}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e3e9e3', fontFamily: 'Cairo' }} />
                  <Legend wrapperStyle={{ fontFamily: 'Cairo', fontSize: 13 }} />
                  <Bar dataKey="إيرادات" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} barSize={22} />
                  <Bar dataKey="منصرفات" fill={CHART_COLORS[3]} radius={[6, 6, 0, 0]} barSize={22} />
                  <Line type="monotone" dataKey="صافي" stroke={CHART_COLORS[2]} strokeWidth={3} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* الفطائر */}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginBottom: 18 }}>
            <CategoryPie title="🧾 توزيع المنصرفات حسب الفئة" data={rep.expByCat} total={rep.totalExp} />
            <CategoryPie title="💰 توزيع الإيرادات حسب الصنف" data={rep.revByCat} total={rep.totalRev} />
          </div>

          {/* إنتاج المنتجات */}
          <div className="card card-pad" style={{ marginBottom: 18 }}>
            <h3 className="rep-h">🧀 إنتاج المنتجات في الفترة</h3>
            {rep.prodByProduct.length === 0 ? <EmptyState icon="🧀" title="لا يوجد إنتاج مُسجّل" /> : (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>المنتج</th><th>الكمية المنتَجة</th><th>الوحدة</th></tr></thead>
                  <tbody>
                    {rep.prodByProduct.map((p) => (
                      <tr key={p.name}>
                        <td style={{ fontWeight: 600 }}>{p.icon} {p.name}</td>
                        <td className="mono" style={{ fontWeight: 700 }}>{fmtNum(p.qty)}</td>
                        <td className="muted">{p.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* تفاصيل المنصرفات بأوصافها */}
          <div className="card card-pad" style={{ marginBottom: 18 }}>
            <h3 className="rep-h">🧾 تفاصيل المنصرفات</h3>
            {rep.expDetail.length === 0 ? <EmptyState icon="🧾" title="لا توجد منصرفات في الفترة" /> : (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>التاريخ</th><th>الفئة</th><th>الوصف</th><th>المبلغ</th></tr></thead>
                  <tbody>
                    {rep.expDetail.map((r, i) => (
                      <tr key={i}>
                        <td className="mono">{fmtDate(r.date)}</td>
                        <td>{r.icon} {r.cat}</td>
                        <td className="muted">{r.note || '—'}</td>
                        <td className="mono text-red" style={{ fontWeight: 700 }}>{fmtRiyal(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* تفاصيل المبيعات */}
          <div className="card card-pad" style={{ marginBottom: 18 }}>
            <h3 className="rep-h">💰 تفاصيل المبيعات</h3>
            {rep.revDetail.length === 0 ? <EmptyState icon="💰" title="لا توجد مبيعات في الفترة" /> : (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>التاريخ</th><th>الصنف</th><th>الكمية</th><th>المشتري</th><th>المبلغ</th></tr></thead>
                  <tbody>
                    {rep.revDetail.map((r, i) => (
                      <tr key={i}>
                        <td className="mono">{fmtDate(r.date)}</td>
                        <td>{r.icon} {r.item}</td>
                        <td className="mono muted">{r.qty ? `${fmtNum(r.qty)} ${r.unit}` : '—'}</td>
                        <td className="muted">{r.buyer || '—'}</td>
                        <td className="mono text-green" style={{ fontWeight: 700 }}>{fmtRiyal(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryPie({ title, data, total }) {
  return (
    <div className="card card-pad">
      <h3 className="rep-h">{title}</h3>
      {data.length === 0 ? <EmptyState icon="🥧" title="لا توجد بيانات" /> : (
        <>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
                innerRadius={55} outerRadius={90} paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmtRiyal(v)}
                contentStyle={{ borderRadius: 12, border: '1px solid #e3e9e3', fontFamily: 'Cairo' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="cat-legend">
            {data.map((c, i) => {
              const pct = total ? (c.value / total) * 100 : 0
              return (
                <div key={c.name} className="cat-row">
                  <span className="dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="cat-name">{c.icon} {c.name}</span>
                  <span className="cat-bar"><span style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} /></span>
                  <span className="mono cat-val">{fmtRiyal(c.value)}</span>
                  <span className="muted mono" style={{ fontSize: 12, minWidth: 44, textAlign: 'left' }}>{fmtNum(pct)}%</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
