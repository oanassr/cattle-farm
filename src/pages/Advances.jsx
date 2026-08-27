import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PageHead, StatCard, EmptyState, Modal, Loader } from '../components/ui'
import DateField from '../components/DateField'
import { fmtRiyal, fmtDate, todayISO, ROLES } from '../lib/format'

const TYPES = { advance: 'سلفة (من المالك)', settlement: 'تسوية / إرجاع' }
const emptyForm = { person_id: '', amount: '', type: 'advance', date: todayISO(), note: '' }

export default function Advances() {
  const { user, role } = useAuth()
  const isOwner = role === 'owner'
  const [balances, setBalances] = useState([])
  const [people, setPeople] = useState({})
  const [staff, setStaff] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const start = `${month}-01`
    const end = new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 1)
      .toISOString().slice(0, 10)
    const [{ data: bal }, { data: profs }, { data: mv }, { data: exp }] = await Promise.all([
      supabase.rpc('advance_balances'),
      supabase.from('profiles').select('id, full_name, role'),
      supabase.from('advances').select('*').gte('date', start).lt('date', end),
      supabase.from('expenses').select('id, date, amount, note, advance_person_id, expense_categories(name)')
        .eq('from_advance', true).gte('date', start).lt('date', end),
    ])
    const pmap = {}
    ;(profs || []).forEach((p) => { pmap[p.id] = p })
    setPeople(pmap)
    setStaff((profs || []).filter((p) => p.role !== 'owner'))
    setBalances((bal || []).filter((b) => pmap[b.person_id] && pmap[b.person_id].role !== 'owner' &&
      (b.total_advance > 0 || b.total_spent > 0 || b.total_settle > 0 || b.balance !== 0)))
    // سجل موحّد: حركات السلف اليدوية + مصروفات من السلفة
    const movements = [
      ...(mv || []).map((r) => ({ id: 'a' + r.id, rawId: r.id, src: 'advance', date: r.date, person_id: r.person_id, kind: r.type, amount: Number(r.amount), note: r.note })),
      ...(exp || []).map((r) => ({ id: 'e' + r.id, src: 'expense', date: r.date, person_id: r.advance_person_id, kind: 'expense', amount: Number(r.amount), note: r.note || r.expense_categories?.name || 'مصروف' })),
    ].sort((a, b) => b.date.localeCompare(a.date))
    setRows(movements)
    setLoading(false)
  }, [month])
  useEffect(() => { load() }, [load])

  const openGrant = (person_id = '', type = 'advance', amount = '') => {
    setForm({ ...emptyForm, person_id, type, amount: amount === '' ? '' : String(amount) })
    setModal(true)
  }

  const save = async (e) => {
    e.preventDefault(); setSaving(true)
    const payload = {
      person_id: form.person_id, amount: Number(form.amount), type: form.type,
      date: form.date, note: form.note || null, created_by: user.id,
    }
    const { error } = await supabase.from('advances').insert(payload)
    setSaving(false)
    if (error) { alert('تعذّر الحفظ: ' + error.message); return }
    setModal(false); load()
  }

  const remove = async (id) => {
    if (!confirm('حذف هذه الحركة؟')) return
    await supabase.from('advances').delete().eq('id', id); load()
  }

  return (
    <div>
      <PageHead title="💵 السلفيات" subtitle={isOwner
        ? 'عُهدة الفريق: كل مصروف «من السلفة» يُسجَّل تلقائياً كسلفة، وتُسوّى شهرياً'
        : 'رصيد عُهدتك الحالي وحركاته'}>
        {isOwner && <button className="btn btn-primary" onClick={() => openGrant()}>＋ حركة سلفة</button>}
      </PageHead>

      {/* بطاقات الأرصدة */}
      {loading ? <Loader /> : (
        <>
          {balances.length === 0 ? (
            <div className="card"><EmptyState icon="💵" title="لا توجد سلفيات بعد"
              hint={isOwner ? 'اضغط «حركة سلفة» لمنح سلفة لمدير' : 'لا يوجد رصيد سلفة عليك'} /></div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: 18 }}>
              {balances.map((b) => {
                const p = people[b.person_id]
                const owes = Number(b.balance)
                return (
                  <div key={b.person_id} className="card card-pad" style={{ borderTop: `4px solid ${owes > 0 ? 'var(--earth-500)' : 'var(--green-700)'}` }}>
                    <div className="row between center">
                      <b style={{ fontSize: 16 }}>{p?.full_name || 'مستخدم'}</b>
                      <span className={`badge badge-${ROLES[p?.role]?.color || 'blue'}`}>{ROLES[p?.role]?.label}</span>
                    </div>
                    <div className="mono" style={{ fontSize: 26, fontWeight: 800, marginTop: 10, color: owes > 0 ? 'var(--earth-500)' : 'var(--green-700)' }}>
                      {fmtRiyal(Math.abs(owes))}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {owes > 0 ? 'رصيد بذمّته (لم يُسوَّ)' : owes < 0 ? 'للمالك عليه (مدفوع زيادة)' : 'مُسوّى بالكامل ✓'}
                    </div>
                    <div className="row" style={{ gap: 14, marginTop: 12, fontSize: 12.5, flexWrap: 'wrap' }}>
                      <span className="muted">ممنوح: <b className="mono">{fmtRiyal(b.total_advance)}</b></span>
                      <span className="muted">مصروف: <b className="mono">{fmtRiyal(b.total_spent)}</b></span>
                      <span className="muted">مُسوّى: <b className="mono">{fmtRiyal(b.total_settle)}</b></span>
                    </div>
                    {isOwner && (
                      <div className="row" style={{ gap: 6, marginTop: 14 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openGrant(b.person_id, 'advance')}>＋ سلفة</button>
                        {owes > 0 && (
                          <button className="btn btn-primary btn-sm" onClick={() => openGrant(b.person_id, 'settlement', owes)}>تسوية الرصيد</button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* الحركات */}
          <div className="row between center" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 16 }}>سجل الحركات</h3>
            <input className="input" type="month" value={month} dir="ltr" style={{ width: 160 }}
              onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="card">
            {rows.length === 0 ? (
              <EmptyState icon="📋" title="لا توجد حركات هذا الشهر" />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>التاريخ</th><th>الشخص</th><th>النوع</th><th>المبلغ</th><th>ملاحظة</th>{isOwner && <th></th>}</tr></thead>
                  <tbody>
                    {rows.map((r) => {
                      const isSettle = r.kind === 'settlement'
                      const label = r.kind === 'settlement' ? '✅ تسوية' : r.kind === 'expense' ? '🧾 مصروف من السلفة' : '⬅️ سلفة نقدية'
                      return (
                        <tr key={r.id}>
                          <td className="mono">{fmtDate(r.date)}</td>
                          <td style={{ fontWeight: 600 }}>{people[r.person_id]?.full_name || '—'}</td>
                          <td><span className={`badge badge-${isSettle ? 'green' : 'amber'}`}>{label}</span></td>
                          <td className="mono" style={{ fontWeight: 700, color: isSettle ? 'var(--green-700)' : 'var(--earth-500)' }}>
                            {isSettle ? '−' : '+'}{fmtRiyal(r.amount)}
                          </td>
                          <td className="muted">{r.note || '—'}</td>
                          {isOwner && (
                            <td>{r.src === 'advance'
                              ? <button className="btn btn-danger btn-sm" onClick={() => remove(r.rawId)}>حذف</button>
                              : <span className="muted" style={{ fontSize: 12 }}>من المنصرفات</span>}</td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {modal && (
        <Modal title="حركة سلفة" onClose={() => setModal(false)}>
          <form onSubmit={save}>
            <div className="field">
              <label>الشخص (المستلم)</label>
              <select className="select" required value={form.person_id}
                onChange={(e) => setForm({ ...form, person_id: e.target.value })}>
                <option value="">— اختر —</option>
                {staff.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({ROLES[p.role]?.label})</option>)}
              </select>
            </div>
            <div className="field">
              <label>نوع الحركة</label>
              <div className="seg" style={{ width: '100%' }}>
                {Object.entries(TYPES).map(([k, v]) => (
                  <button type="button" key={k} className={`seg-btn ${form.type === k ? 'active' : ''}`}
                    style={{ flex: 1 }} onClick={() => setForm({ ...form, type: k })}>{v}</button>
                ))}
              </div>
            </div>
            <div className="row row-wrap" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label>المبلغ (﷼)</label>
                <input className="input" type="number" min="0" step="0.01" required dir="ltr"
                  value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <DateField value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            </div>
            <div className="field">
              <label>ملاحظة (اختياري)</label>
              <textarea className="input" value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })} />
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
