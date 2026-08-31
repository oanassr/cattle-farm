import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { isSupabaseConfigured } from './lib/supabase'
import Layout from './components/Layout'
import SetupNotice from './components/SetupNotice'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Revenues from './pages/Revenues'
import Production from './pages/Production'
import Advances from './pages/Advances'
import Reports from './pages/Reports'
import Periods from './pages/Periods'
import Warehouse from './pages/Warehouse'
import Users from './pages/Users'
import ControlPanel from './pages/ControlPanel'

function FullLoader() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  )
}

function Guard({ children, roles }) {
  const { user, role, loading } = useAuth()
  if (loading) return <FullLoader />
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(role)) return <Navigate to="/" replace />
  return children
}

// الصفحة الرئيسية بحسب الدور
function Home() {
  const { role } = useAuth()
  if (role === 'seller') return <Navigate to="/revenues" replace />
  if (role === 'storekeeper') return <Navigate to="/warehouse" replace />
  return <Dashboard />
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupNotice />

  const MG = ['owner', 'manager']

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route index element={<Home />} />
        <Route path="expenses" element={<Guard roles={MG}><Expenses /></Guard>} />
        <Route path="revenues" element={<Revenues />} />
        <Route path="production" element={<Guard roles={MG}><Production /></Guard>} />
        <Route path="warehouse" element={<Guard roles={['owner', 'manager', 'storekeeper']}><Warehouse /></Guard>} />
        <Route path="advances" element={<Guard roles={MG}><Advances /></Guard>} />
        <Route path="milk" element={<Navigate to="/production" replace />} />
        <Route path="reports" element={<Guard roles={MG}><Reports /></Guard>} />
        <Route path="periods" element={<Guard roles={['owner']}><Periods /></Guard>} />
        <Route path="control" element={<Guard roles={['owner']}><ControlPanel /></Guard>} />
        <Route path="users" element={<Guard roles={['owner']}><Users /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
