// أدوات تنسيق مشتركة

export const ROLES = {
  owner:   { label: 'مالك المزرعة', color: 'green' },
  manager: { label: 'مدير المزرعة', color: 'blue' },
  seller:  { label: 'بائع',          color: 'amber' },
}

export const PAYMENT_METHODS = {
  cash:   'نقدي',
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

export const todayISO = () => new Date().toISOString().slice(0, 10)

export const monthName = (m) =>
  ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'][m]

// ألوان الرسوم البيانية
export const CHART_COLORS = [
  '#15803d', '#d97706', '#2563eb', '#dc2626', '#7c3aed',
  '#0891b2', '#ca8a04', '#db2777', '#059669', '#9333ea',
]
