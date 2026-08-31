// أدوات تنسيق مشتركة

export const ROLES = {
  owner:      { label: 'مالك المزرعة', color: 'green' },
  manager:    { label: 'مدير المزرعة', color: 'blue' },
  seller:     { label: 'بائع',          color: 'amber' },
  storekeeper:{ label: 'أمين المخزن',  color: 'blue' },
}

export const PAYMENT_METHODS = {
  cash:   'كاش',
  card:   'شبكة',
  bank:   'تحويل بنكي',
  credit: 'آجل',
}

const money = new Intl.NumberFormat('ar-SA', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export const fmtMoney = (n) => money.format(Number(n || 0))

export const fmtRiyal = (n) => `${fmtMoney(n)} ﷼`

export const fmtNum = (n) =>
  new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 }).format(Number(n || 0))

export const fmtDate = (d) =>
  new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(d))

export const fmtDateShort = (d) =>
  new Intl.DateTimeFormat('ar-SA', { month: 'short', day: 'numeric' }).format(new Date(d))

// التاريخ الهجري (أم القرى)
export const fmtDateHijri = (d) => {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',
      { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(d)) + ' هـ'
  } catch { return '' }
}

// أشهر السنة الهجرية
export const HIJRI_MONTHS = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
]

// تحويل ميلادي ISO → مكوّنات هجرية {y,m,d}
const _hParts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura-nu-latn',
  { year: 'numeric', month: 'numeric', day: 'numeric' })
export const gregToHijri = (iso) => {
  try {
    const p = _hParts.formatToParts(new Date(iso))
    const g = (t) => Number(p.find((x) => x.type === t)?.value)
    return { y: g('year'), m: g('month'), d: g('day') }
  } catch { return null }
}

// تحويل هجري (y,m,d) → ميلادي ISO (بحث حول تقدير أولي)
export const hijriToISO = (hy, hm, hd) => {
  const approx = Date.UTC(622, 6, 19) + Math.round((hy - 1) * 354.367 + (hm - 1) * 29.53 + (hd - 1)) * 86400000
  for (let off = -45; off <= 45; off++) {
    const dt = new Date(approx + off * 86400000)
    const p = gregToHijri(dt.toISOString())
    if (p && p.y === hy && p.m === hm && p.d === hd) return dt.toISOString().slice(0, 10)
  }
  return new Date(approx).toISOString().slice(0, 10)
}

export const todayISO = () => new Date().toISOString().slice(0, 10)

export const monthName = (m) =>
  ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'][m]

// ألوان الرسوم البيانية
export const CHART_COLORS = [
  '#15803d', '#d97706', '#2563eb', '#dc2626', '#7c3aed',
  '#0891b2', '#ca8a04', '#db2777', '#059669', '#9333ea',
]
