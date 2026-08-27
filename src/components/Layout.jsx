import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ROLES } from '../lib/format'
import './Layout.css'

const NAV = [
  { to: '/',           label: 'الرئيسية',    ic: '🏠', roles: ['owner', 'manager'] },
  { to: '/revenues',   label: 'الإيرادات',   ic: '💰', roles: ['owner', 'manager', 'seller'] },
  { to: '/expenses',   label: 'المنصرفات',   ic: '🧾', roles: ['owner', 'manager'] },
  { to: '/advances',   label: 'السلفيات',    ic: '💵', roles: ['owner', 'manager'] },
  { to: '/production', label: 'المنتجات',    ic: '🧀', roles: ['owner', 'manager'] },
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
    </div>
  )
}
