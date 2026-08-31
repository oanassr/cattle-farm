import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import InstallApp from '../components/InstallApp'

export default function Login() {
  const { user, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setLoading(true)
    const { error } = await signIn(email.trim(), password)
    setLoading(false)
    if (error) {
      setErr(
        error.message?.includes('Invalid')
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
          : 'تعذّر تسجيل الدخول، حاول مرة أخرى.'
      )
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20,
      background: 'linear-gradient(135deg, #f0fdf4 0%, #f4f7f2 60%, #fef3c7 100%)',
    }}>
      <div className="card fade-in" style={{ width: '100%', maxWidth: 400, overflow: 'hidden' }}>
        <div style={{ background: 'var(--green-700)', color: '#fff', padding: '30px 26px', textAlign: 'center' }}>
          <div style={{ fontSize: 52 }}>🐄</div>
          <h1 style={{ fontSize: 24, marginTop: 6 }}>مزرعة وثيج</h1>
          <p style={{ opacity: .85, fontSize: 14 }}>نظام إدارة منصرفات وإيرادات المزرعة</p>
        </div>

        <form onSubmit={submit} className="card-pad">
          <div className="field">
            <label>البريد الإلكتروني</label>
            <input className="input" type="email" dir="ltr" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" autoComplete="email" />
          </div>
          <div className="field">
            <label>كلمة المرور</label>
            <input className="input" type="password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password" />
          </div>

          {err && (
            <div className="badge badge-red" style={{ width: '100%', justifyContent: 'center', padding: 10, marginBottom: 14 }}>
              {err}
            </div>
          )}

          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <span className="spinner" /> : 'تسجيل الدخول'}
          </button>

          <p className="muted" style={{ fontSize: 13, textAlign: 'center', marginTop: 16 }}>
            الحسابات يُنشئها مالك المزرعة من صفحة المستخدمين.
          </p>

          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <InstallApp block />
          </div>
        </form>
      </div>
    </div>
  )
}
