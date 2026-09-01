import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { adminAuthClient } from '../lib/adminClient'
import { useAuth } from '../contexts/AuthContext'
import { PageHead, Loader, Modal, EmptyState } from '../components/ui'
import { ROLES, fmtDate } from '../lib/format'

const empty = { full_name: '', email: '', password: '', role: 'seller' }

export default function Users() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [pwFor, setPwFor] = useState(null)
  const [pwValue, setPwValue] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)

  const submitPassword = async (e) => {
    e.preventDefault(); setPwSaving(true); setPwMsg(null)
    const { data, error } = await supabase.functions.invoke('set-password', { body: { user_id: pwFor.id, password: pwValue } })
    setPwSaving(false)
    if (error || data?.error) { setPwMsg({ type: 'err', text: 'تعذّر: ' + (data?.error || error.message) }); return }
    setPwMsg({ type: 'ok', text: 'تم تغيير كلمة المرور بنجاح ✔' })
    setPwValue('')
  }

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const changeRole = async (id, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (error) { alert('تعذّر تغيير الدور: ' + error.message); return }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, role } : r)))
  }

  const addUser = async (e) => {
    e.preventDefault()
    setSaving(true); setMsg(null)
    const payload = { email: form.email.trim(), password: form.password, full_name: form.full_name, role: form.role }

    // المسار الآمن: Edge Function (بعد نشرها + إيقاف التسجيل العام)
    try {
      const { data, error } = await supabase.functions.invoke('create-user', { body: payload })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setSaving(false)
      setMsg({ type: 'ok', text: 'تم إنشاء الحساب بنجاح.' })
      setForm(empty); setTimeout(load, 600)
      return
    } catch (fnErr) {
      // تراجع مؤقت: الطريقة القديمة (تعمل ما دام التسجيل العام مفعّلاً)
      const { error: sErr } = await adminAuthClient.auth.signUp({
        email: payload.email, password: payload.password,
        options: { data: { full_name: payload.full_name, role: payload.role } },
      })
      await adminAuthClient.auth.signOut()
      setSaving(false)
      if (sErr) {
        setMsg({ type: 'err', text: 'تعذّر إنشاء الحساب: ' + sErr.message })
        return
      }
      setMsg({ type: 'ok', text: 'تم إنشاء الحساب (يمكنك ضبط الدور من القائمة). للأمان الكامل انشر دالة create-user وأوقف التسجيل العام.' })
      setForm(empty); setTimeout(load, 800)
    }
  }

  return (
    <div>
      <PageHead title="👥 المستخدمون" subtitle="إدارة حسابات وأدوار فريق المزرعة">
        <button className="btn btn-primary" onClick={() => { setForm(empty); setMsg(null); setModal(true) }}>
          ＋ إضافة مستخدم
        </button>
      </PageHead>

      <div className="card">
        {loading ? <Loader /> : rows.length === 0 ? (
          <EmptyState icon="👥" title="لا يوجد مستخدمون" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>الاسم</th><th>الدور</th><th>تاريخ الإنشاء</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const isMe = r.id === user.id
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>
                        {r.full_name || '—'} {isMe && <span className="badge badge-green">أنت</span>}
                      </td>
                      <td>
                        {isMe ? (
                          <span className={`badge badge-${ROLES[r.role]?.color}`}>{ROLES[r.role]?.label}</span>
                        ) : (
                          <select className="select" value={r.role} style={{ maxWidth: 170 }}
                            onChange={(e) => changeRole(r.id, e.target.value)}>
                            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="mono muted">{fmtDate(r.created_at)}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => { setPwFor(r); setPwValue(''); setPwMsg(null) }}>🔑 كلمة المرور</button>
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
        <Modal title="إضافة مستخدم جديد" onClose={() => setModal(false)}>
          <form onSubmit={addUser}>
            <div className="field">
              <label>الاسم الكامل</label>
              <input className="input" required value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="field">
              <label>البريد الإلكتروني</label>
              <input className="input" type="email" dir="ltr" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field">
              <label>كلمة المرور المؤقتة</label>
              <input className="input" type="text" dir="ltr" required minLength={6} value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="6 أحرف على الأقل" />
            </div>
            <div className="field">
              <label>الدور</label>
              <select className="select" value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {msg && (
              <div className={`badge badge-${msg.type === 'ok' ? 'green' : 'red'}`}
                style={{ width: '100%', justifyContent: 'center', padding: 10, marginBottom: 12, lineHeight: 1.5 }}>
                {msg.text}
              </div>
            )}
            <button className="btn btn-primary btn-block" disabled={saving}>
              {saving ? <span className="spinner" /> : 'إنشاء الحساب'}
            </button>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 12, lineHeight: 1.6 }}>
              💡 لتفعيل الحسابات فوراً بدون بريد تأكيد: من لوحة Supabase ← Authentication ← Providers ← Email،
              أوقف خيار «Confirm email».
            </p>
          </form>
        </Modal>
      )}

      {pwFor && (
        <Modal title={`🔑 تغيير كلمة مرور: ${pwFor.full_name || ''}`} onClose={() => setPwFor(null)}>
          <form onSubmit={submitPassword}>
            <div className="field">
              <label>كلمة المرور الجديدة</label>
              <input className="input" type="text" dir="ltr" required minLength={6} value={pwValue}
                onChange={(e) => setPwValue(e.target.value)} placeholder="6 أحرف على الأقل" autoFocus />
            </div>
            {pwMsg && (
              <div className={`badge badge-${pwMsg.type === 'ok' ? 'green' : 'red'}`}
                style={{ width: '100%', justifyContent: 'center', padding: 10, marginBottom: 12, lineHeight: 1.5 }}>
                {pwMsg.text}
              </div>
            )}
            <button className="btn btn-primary btn-block" disabled={pwSaving}>
              {pwSaving ? <span className="spinner" /> : 'حفظ كلمة المرور'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
