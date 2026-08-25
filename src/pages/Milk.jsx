import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PageHead, StatCard, EmptyState, Modal, Loader } from '../components/ui'
import { fmtNum, fmtDate, todayISO } from '../lib/format'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { fmtDateShort } from '../lib/format'

const SESSIONS = { total: 'إجمالي اليوم', morning: 'حلبة الصباح', evening: 'حلبة المساء' }
const empty = { date: todayISO(), quantity_liters: '', session: 'total', note: '' }

export default function Milk() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const start = `${month}-01`
    const end = new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 1)
      .toISOString().slice(0, 10)
    const { data } = await supabase.from('milk_production')
      .select('*').gte('date', start).lt('date', end).order('date', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const openAdd = () => { setForm({ ...empty }); setEditId(null); setModal(true) }
  const openEdit = (r) => {
    setForm({ date: r.date, quantity_liters: r.quantity_liters, session: r.session, note: r.note || '' })
    setEditId(r.id); setModal(true)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      date: form.date, quantity_liters: Number(form.quantity_liters),
      session: form.session, note: form.note || null,
    }
    let error
    if (editId) {
      ({ error } = await supabase.from('milk_production').update(payload).eq('id', editId))
    } else {
      ({ error } = await supabase.from('milk_production').insert({ ...payload, created_by: user.id }))
    }
    setSaving(false)
    if (error) {
      alert(error.code === '23505'
        ? 'يوجد تسجيل لنفس التاريخ والحلبة مسبقاً.'
        : 'حدث خطأ أثناء الحفظ: ' + error.message)
      return
    }
    setModal(false); load()
  }

  const remove = async (id) => {
    if (!confirm('هل تريد حذف هذا التسجيل؟')) return
    await supabase.from('milk_production').delete().eq('id', id)
    load()
  }

  const total = rows.reduce((s, r) => s + Number(r.quantity_liters), 0)
  const days = new Set(rows.map((r) => r.date)).size
  const avg = days ? total / days : 0

  const chartData = Object.values(
    rows.reduce((acc, r) => {
      acc[r.date] = acc[r.date] || { date: r.date, لتر: 0 }
      acc[r.date].لتر += Number(r.quantity_liters)
      return acc
    }, {})
  ).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div>
      <PageHead title="🥛 إنتاج الحليب" subtitle="تتبّع كمية الحليب اليومية">
        <button className="btn btn-primary" onClick={openAdd}>＋ تسجيل إنتاج</button>
      </PageHead>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 18 }}>
        <StatCard icon="🥛" label="إجمالي الشهر" value={`${fmtNum(total)} لتر`} tone="blue" isMoney={false} />
        <StatCard icon="📈" label="متوسط يومي" value={`${fmtNum(avg)} لتر`} tone="green" isMoney={false} sub={`${days} يوم مُسجّل`} />
        <div className="card card-pad">
          <label style={{ fontWeight: 700, fontSize: 14 }}>عرض شهر</label>
          <input className="input" type="month" value={month} dir="ltr"
            onChange={(e) => setMonth(e.target.value)} style={{ marginTop: 8 }} />
        </div>
      </div>

      {chartData.length > 1 && (
        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>منحنى الإنتاج اليومي</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="milkG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2ee" />
              <XAxis dataKey="date" tickFormatter={fmtDateShort} tick={{ fontSize: 12 }} reversed={false} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip labelFormatter={fmtDate} formatter={(v) => [`${fmtNum(v)} لتر`, 'الكمية']} />
              <Area type="monotone" dataKey="لتر" stroke="#2563eb" strokeWidth={2.5} fill="url(#milkG)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        {loading ? <Loader /> : rows.length === 0 ? (
          <EmptyState icon="🥛" title="لا توجد تسجيلات هذا الشهر" hint="اضغط «تسجيل إنتاج» للبدء" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>التاريخ</th><th>الحلبة</th><th>الكمية (لتر)</th><th>ملاحظة</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{fmtDate(r.date)}</td>
                    <td><span className="badge badge-blue">{SESSIONS[r.session]}</span></td>
                    <td className="mono" style={{ fontWeight: 700 }}>{fmtNum(r.quantity_liters)}</td>
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
        <Modal title={editId ? 'تعديل تسجيل' : 'تسجيل إنتاج حليب'} onClose={() => setModal(false)}>
          <form onSubmit={save}>
            <div className="row row-wrap" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 150 }}>
                <label>التاريخ</label>
                <input className="input" type="date" required dir="ltr"
                  value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 150 }}>
                <label>الحلبة</label>
                <select className="select" value={form.session}
                  onChange={(e) => setForm({ ...form, session: e.target.value })}>
                  {Object.entries(SESSIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>الكمية (لتر)</label>
              <input className="input" type="number" min="0" step="0.1" required dir="ltr"
                value={form.quantity_liters}
                onChange={(e) => setForm({ ...form, quantity_liters: e.target.value })} />
            </div>
            <div className="field">
              <label>ملاحظة (اختياري)</label>
              <textarea className="input" value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <button className="btn btn-primary btn-block" disabled={saving}>
              {saving ? <span className="spinner" /> : (editId ? 'حفظ التعديل' : 'حفظ')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
