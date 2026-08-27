import { useState } from 'react'
import { fmtDateHijri, HIJRI_MONTHS, gregToHijri, hijriToISO } from '../lib/format'

// حقل تاريخ بخيار (ميلادي/هجري). القيمة المخزّنة دائماً ميلادي ISO (YYYY-MM-DD).
export default function DateField({ value, onChange, label = 'التاريخ', style }) {
  const [mode, setMode] = useState('greg')
  const h = value ? gregToHijri(value) : null
  const cy = h?.y || 1447
  const years = []
  for (let y = cy - 4; y <= cy + 2; y++) years.push(y)

  const setH = (hy, hm, hd) => onChange(hijriToISO(hy, hm, Math.min(hd, 30)))

  return (
    <div className="field" style={{ flex: 1, minWidth: 200, ...style }}>
      <div className="row between center" style={{ marginBottom: 7 }}>
        <label style={{ margin: 0 }}>{label}</label>
        <div className="seg seg-sm" style={{ padding: 3 }}>
          <button type="button" className={`seg-btn ${mode === 'greg' ? 'active' : ''}`}
            style={{ padding: '5px 10px' }} onClick={() => setMode('greg')}>ميلادي</button>
          <button type="button" className={`seg-btn ${mode === 'hijri' ? 'active' : ''}`}
            style={{ padding: '5px 10px' }} onClick={() => setMode('hijri')}>هجري</button>
        </div>
      </div>

      {mode === 'greg' ? (
        <>
          <input className="input" type="date" required dir="ltr" value={value}
            onChange={(e) => onChange(e.target.value)} />
          <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>📅 {fmtDateHijri(value)}</div>
        </>
      ) : (
        <>
          <div className="row" style={{ gap: 6 }}>
            <select className="select" value={h?.d || 1} style={{ paddingLeft: 26 }}
              onChange={(e) => setH(h.y, h.m, Number(e.target.value))}>
              {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="select" value={h?.m || 1}
              onChange={(e) => setH(h.y, Number(e.target.value), h.d)}>
              {HIJRI_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select className="select" value={h?.y || cy} style={{ paddingLeft: 26 }}
              onChange={(e) => setH(Number(e.target.value), h.m, h.d)}>
              {years.map((y) => <option key={y} value={y}>{y} هـ</option>)}
            </select>
          </div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 4, direction: 'ltr', textAlign: 'right' }}>📅 ميلادي: {value}</div>
        </>
      )}
    </div>
  )
}
