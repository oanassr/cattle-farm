// دالة آمنة لإنشاء المستخدمين — للمالك فقط.
// تستبدل التسجيل العام: بعد نشرها، أوقف «Allow new users to sign up».
// تستخدم مفتاح الخدمة (يُحقن تلقائياً في بيئة الدالة) ولا يظهر في المتصفح.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') || ''

    // 1) تحقق أن الطالب مالك
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: uErr } = await asUser.auth.getUser()
    if (uErr || !user) return json({ error: 'غير مصرّح' }, 401)

    const admin = createClient(url, service)
    const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (!prof || prof.role !== 'owner') return json({ error: 'هذه العملية للمالك فقط' }, 403)

    // 2) أنشئ المستخدم بمفتاح الخدمة (مؤكَّد فوراً)
    const { email, password, full_name, role } = await req.json()
    if (!email || !password) return json({ error: 'البريد وكلمة المرور مطلوبان' }, 400)
    const validRole = ['owner', 'manager', 'seller'].includes(role) ? role : 'seller'

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name },
    })
    if (cErr) return json({ error: cErr.message }, 400)

    // 3) اضبط الاسم والدور (التريجر ينشئ الملف كـ seller)
    await admin.from('profiles').update({ full_name, role: validRole }).eq('id', created.user.id)
    return json({ ok: true, id: created.user.id })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
