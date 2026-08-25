import { fmtRiyal } from '../lib/format'

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head row between row-wrap" style={{ gap: 12 }}>
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export function StatCard({ icon, label, value, tone = 'green', sub, isMoney = true }) {
  const tones = {
    green: 'var(--green-700)', red: 'var(--red-600)',
    blue: 'var(--blue-600)', amber: 'var(--earth-500)',
  }
  return (
    <div className="card card-pad" style={{ borderTop: `4px solid ${tones[tone]}` }}>
      <div className="row between center">
        <span className="muted" style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
        <span style={{ fontSize: 24 }}>{icon}</span>
      </div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 800, marginTop: 8, color: tones[tone] }}>
        {isMoney ? fmtRiyal(value) : value}
      </div>
      {sub && <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function EmptyState({ icon = '📭', title, hint }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--muted)' }}>
      <div style={{ fontSize: 46, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
      {hint && <div style={{ fontSize: 14, marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,40,30,.45)',
      display: 'grid', placeItems: 'center', padding: 16,
    }}>
      <div className="card fade-in" onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: wide ? 640 : 460, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="row between center card-pad" style={{ borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <h2 style={{ fontSize: 19 }}>{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="card-pad">{children}</div>
      </div>
    </div>
  )
}

export function Loader() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: 60 }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )
}
