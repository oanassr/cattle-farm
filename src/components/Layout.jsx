import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Modal } from './ui'
import { ROLES } from '../lib/format'
import './Layout.css'

const NAV = [
  { to: '/',           label: 'الرئيسية',    ic: '🏠', roles: ['owner', 'manager'] },
  { to: '/revenues',   label: 'الإيرادات',   ic: '💰', roles: ['owner', 'manager', 'seller'] },
  { to: '/expenses',   label: 'المنصرفات',   ic: '🧾', roles: ['owner', 'manager'] },
  { to: '/advances',   label: 'السلفيات',    ic: '💵', roles: ['owner', 'manager'] },
  { to: '/production', label: 'المنتجات',    ic: '🧀', roles: ['owner', 'manager'] },
  { to: '/warehouse',  label: 'المخزن',      ic: '🏬', roles: ['owner', 'manager', 'storekeeper'] },
  { to: '/reports',    label: 'التقارير',    ic: '📊', roles: ['owner', 'manager'] },
  { to: '/periods',    label: 'الفترات',     ic: '🗓️', roles: ['owner'] },
  { to: '/control',    label: 'لوحة التحكم', ic: '🛠️', roles: ['owner'] },
  { to: '/users',      label: 'المستخدمون',  ic: '👥', roles: ['owner'] },
]

export default function Layout() {
  const { profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  const items = NAV.filter((n) => n.roles.includes(role))
  const name = profile?.full_name || 'مستخدم'
  const roleInfo = ROLES[role] || { label: role }

  const [pw, setPw] = useState(false)
  const [pwValue, setPwValue] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)

  const changeMyPassword = async (e) => {
    e.preventDefault(); setPwSaving(true); setPwMsg(null)
    const { error } = await supabase.auth.updateUser({ password: pwValue })
    setPwSaving(false)
    if (error) { setPwMsg({ type: 'err', text: 'تعذّر: ' + error.message }); return }
    setPwMsg({ type: 'ok', text: 'تم تغيير كلمة مرورك بنجاح ✔' })
    setPwValue('')
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo">🐄</span>
          <span>مزرعة وثيج<small>إدارة مزرعة الأبقار</small></span>
        </div>
        <div className="user-chip">
          <div className="who">
            <b>{name}</b>
            <span className={`badge badge-${roleInfo.color || 'green'}`} style={{ marginTop: 2 }}>
              {roleInfo.label}
            </span>
          </div>
          <div className="avatar">{name.trim().charAt(0)}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setPw(true); setPwValue(''); setPwMsg(null) }} title="تغيير كلمة المرور">
            🔑
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut} title="تسجيل الخروج">
            خروج
          </button>
        </div>
      </header>

      <div className="app-body">
        <nav className="sidenav">
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="ic">{n.ic}</span>{n.label}
            </NavLink>
          ))}
        </nav>

        <main className="content fade-in">
          <Outlet />
        </main>
      </div>

      <nav className="bottomnav">
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}
            className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="ic">{n.ic}</span>{n.label}
          </NavLink>
        ))}
      </nav>

      {pw && (
        <Modal title="🔑 تغيير كلمة المرور" onClose={() => setPw(false)}>
          <form onSubmit={changeMyPassword}>
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
              {pwSaving ? <span className="spinner" /> : 'حفظ'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
