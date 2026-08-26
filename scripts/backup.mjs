// نسخ احتياطي لكل بيانات «مزرعتي» إلى ملفات CSV محلية.
// الاستخدام (PowerShell):
//   $env:OWNER_EMAIL="owner@mazraati.com"; $env:OWNER_PASSWORD="********"; node scripts/backup.mjs
// تُحفظ النسخة في مجلد: backups/backup-YYYY-MM-DD/
// آمن: يقرأ ببيانات المالك (يرى كل الصفوف)، ولا يحتوي أي مفتاح سرّي.

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const URL = process.env.SUPABASE_URL || 'https://bbzumgiionzmofjkrczr.supabase.co'
const KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_5qB2MDFMPyuOZcsJ9CDOQg_u2W28sqI'
const EMAIL = process.env.OWNER_EMAIL
const PASSWORD = process.env.OWNER_PASSWORD

if (!EMAIL || !PASSWORD) {
  console.error('❌ عرّف OWNER_EMAIL و OWNER_PASSWORD في متغيرات البيئة أولاً.')
  process.exit(1)
}

const TABLES = [
  'profiles', 'units', 'products', 'expense_categories', 'revenue_categories',
  'expenses', 'revenues', 'production', 'advances', 'promotions', 'milk_production',
]

const toCSV = (rows) => {
  if (!rows.length) return ''
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const esc = (v) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

const main = async () => {
  const lr = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const auth = await lr.json()
  if (!auth.access_token) { console.error('❌ فشل تسجيل الدخول:', auth.msg || auth.error_code); process.exit(1) }
  const H = { apikey: KEY, Authorization: `Bearer ${auth.access_token}` }

  const day = new Date().toISOString().slice(0, 10)
  const dir = join('backups', `backup-${day}`)
  mkdirSync(dir, { recursive: true })

  let total = 0
  const summary = []
  for (const t of TABLES) {
    const r = await fetch(`${URL}/rest/v1/${t}?select=*`, { headers: H })
    if (!r.ok) { console.warn(`⚠️  تخطّي ${t}: HTTP ${r.status}`); continue }
    const rows = await r.json()
    writeFileSync(join(dir, `${t}.csv`), '﻿' + toCSV(rows), 'utf8')
    total += rows.length
    summary.push(`${t}: ${rows.length}`)
    console.log(`✅ ${t}: ${rows.length} صف`)
  }
  writeFileSync(join(dir, '_ملخص.txt'),
    `نسخة احتياطية — مزرعتي\nالتاريخ: ${new Date().toISOString()}\nإجمالي الصفوف: ${total}\n\n${summary.join('\n')}\n`, 'utf8')
  console.log(`\n📦 اكتملت النسخة (${total} صف) في: ${dir}`)
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
